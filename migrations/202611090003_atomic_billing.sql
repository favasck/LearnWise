-- Review against the production report first. Apply after schema reconciliation.
-- Existing duplicate invoice numbers or inconsistent balances abort the transaction.
begin;

-- Retire ALL older overloads from application roles, including the reported
-- 10-argument function. Never trust caller-supplied actor IDs/roles.
do $$ declare f record; begin
 for f in select p.oid,pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='record_payment'
 loop
  execute format('revoke all on function public.record_payment(%s) from public,anon,authenticated',f.args);
  if has_function_privilege('authenticated',f.oid,'EXECUTE') or has_function_privilege('anon',f.oid,'EXECUTE') then
   raise exception 'Inherited privileges keep an old payment overload callable; review role grants';
  end if;
 end loop;
end $$;
-- Table-level REVOKE does not remove older column-level write grants.
do $$ declare t text; columns_sql text; begin
 foreach t in array array['payments','invoices'] loop
  select string_agg(quote_ident(attname),', ') into columns_sql from pg_attribute
   where attrelid=('public.'||t)::regclass and attnum>0 and not attisdropped;
  execute format('revoke insert (%s), update (%s), references (%s) on public.%I from public,anon,authenticated',columns_sql,columns_sql,columns_sql,t);
 end loop;
end $$;
do $$ begin
 if exists (select 1 from public.payments where amount_qar <= 0) or exists (
   select 1 from public.invoices i where paid_qar <> coalesce((select sum(p.amount_qar) from public.payments p where p.invoice_id=i.id),0)
 ) or exists (
   select 1 from public.payments p join public.invoices i on i.id=p.invoice_id
   where p.parent_id<>i.parent_id or p.student_id is distinct from i.student_id
 ) then raise exception 'Existing ledger requires reconciliation; no billing changes applied'; end if;
end $$;
create unique index if not exists invoices_unique_number on public.invoices(invoice_number);
create table public.billing_audit_events (
 id uuid primary key default gen_random_uuid(), actor_user_id uuid not null,
 action text not null, record_id uuid not null, occurred_at timestamptz not null default now()
);
alter table public.billing_audit_events enable row level security;
revoke all on public.billing_audit_events from public, anon, authenticated;
grant select on public.billing_audit_events to authenticated;
create policy billing_admin_read on public.billing_audit_events for select to authenticated using(learnwise_private.active_profile_role()='super_admin');

-- A request UUID is also the payment UUID. A retry must carry the same payload.
create or replace function public.record_payment(p_request_id uuid, p_payment jsonb)
returns public.payments language plpgsql security definer set search_path='' as $$
declare inv public.invoices; previous public.payments; result public.payments;
 amount numeric; parent uuid; student uuid; invoice uuid; tutor uuid; method text; reference text; notes text;
begin
 if coalesce(learnwise_private.active_profile_role() not in ('super_admin','admin_tutor'),true) then raise exception 'Active administrator required' using errcode='42501'; end if;
 if p_request_id is null or p_payment is null or jsonb_typeof(p_payment)<>'object' then raise exception 'Payment and request ID required'; end if;
 if exists(select 1 from jsonb_object_keys(p_payment) k where k not in ('invoice_id','parent_id','student_id','tutor_id','amount_qar','method','reference','notes')) then raise exception 'Unsupported payment field'; end if;
 amount := (p_payment->>'amount_qar')::numeric;
 if amount is null or amount::text in ('NaN','Infinity','-Infinity') or amount<=0 or amount<>round(amount,2) or amount>99999999.99 then raise exception 'Amount must be positive QAR with at most two decimal places'; end if;
 parent := (p_payment->>'parent_id')::uuid; student := (p_payment->>'student_id')::uuid;
 invoice := (p_payment->>'invoice_id')::uuid; tutor := (p_payment->>'tutor_id')::uuid;
 method := p_payment->>'method'; reference := p_payment->>'reference'; notes := p_payment->>'notes';
 -- Serialize identical retries, including unallocated payments.
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into previous from public.payments where id=p_request_id;
 if found then
  if previous.invoice_id is distinct from invoice or previous.parent_id is distinct from parent
    or previous.student_id is distinct from student or previous.tutor_id is distinct from tutor
    or previous.amount_qar is distinct from amount or previous.method is distinct from method
    or previous.reference is distinct from reference or previous.notes is distinct from notes
  then raise exception 'Request ID already used with different payment details'; end if;
  return previous;
 end if;
 if parent is null or not exists(select 1 from public.parents where id=parent) then raise exception 'Parent not found'; end if;
 if student is not null and not exists(select 1 from public.students where id=student and parent_id=parent) then raise exception 'Student does not belong to parent'; end if;
 if invoice is not null then
  select * into inv from public.invoices where id=invoice for update;
  if not found or inv.parent_id<>parent or inv.student_id is distinct from student then raise exception 'Invoice relationship mismatch'; end if;
  if inv.status not in ('Issued','Partially Paid','Overdue') then raise exception 'Only an issued outstanding invoice accepts payments'; end if;
  if amount>inv.total_qar-inv.paid_qar then raise exception 'Payment exceeds outstanding balance'; end if;
 end if;
 insert into public.payments(id,invoice_id,parent_id,student_id,tutor_id,amount_qar,method,reference,notes)
 values(p_request_id,invoice,parent,student,tutor,amount,method,reference,notes) returning * into result;
 if invoice is not null then
  update public.invoices set paid_qar=paid_qar+amount,
   status=case when paid_qar+amount=total_qar then 'Paid' else 'Partially Paid' end
   where id=invoice;
 end if;
 insert into public.billing_audit_events(actor_user_id,action,record_id) values(auth.uid(),'payment_recorded',result.id);
 return result;
end $$;
revoke all on function public.record_payment(uuid,jsonb) from public,anon;
grant execute on function public.record_payment(uuid,jsonb) to authenticated;
revoke insert,update,delete on public.payments from public,anon,authenticated;

create or replace function public.create_invoice(p_request_id uuid,p_invoice jsonb)
returns public.invoices language plpgsql security definer set search_path='' as $$
declare result public.invoices; subtotal numeric; discount numeric; parent uuid; student uuid;
begin
 if coalesce(learnwise_private.active_profile_role() not in ('super_admin','admin_tutor'),true) then raise exception 'Active administrator required' using errcode='42501'; end if;
 if p_request_id is null or p_invoice is null or jsonb_typeof(p_invoice)<>'object' then raise exception 'Invoice and request ID required'; end if;
 if exists(select 1 from jsonb_object_keys(p_invoice) k where k not in ('parent_id','student_id','subtotal_qar','discount_qar','period_start','period_end','notes','status')) then raise exception 'Unsupported invoice field'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 -- Store the original payload separately so altered retries cannot silently succeed.
 select * into result from public.invoices where id=p_request_id;
 if found then
  if not exists(select 1 from public.invoice_requests where id=p_request_id and payload=p_invoice) then raise exception 'Request ID already used with different invoice details'; end if;
  return result;
 end if;
 subtotal := (p_invoice->>'subtotal_qar')::numeric; discount := coalesce((p_invoice->>'discount_qar')::numeric,0);
 if subtotal is null or subtotal::text in ('NaN','Infinity','-Infinity') or discount::text in ('NaN','Infinity','-Infinity')
  or subtotal<=0 or discount<0 or discount>=subtotal or subtotal<>round(subtotal,2) or discount<>round(discount,2)
  or subtotal>99999999.99 then raise exception 'Invalid QAR subtotal or discount'; end if;
 parent := (p_invoice->>'parent_id')::uuid; student := (p_invoice->>'student_id')::uuid;
 if student is not null and not exists(select 1 from public.students where id=student and parent_id=parent) then raise exception 'Student does not belong to parent'; end if;
 if coalesce(p_invoice->>'status','Draft') not in ('Draft','Issued') then raise exception 'New invoice must be Draft or Issued'; end if;
 if (p_invoice->>'period_end')::date < (p_invoice->>'period_start')::date then raise exception 'Invoice period ends before it starts'; end if;
 insert into public.invoices(id,parent_id,student_id,invoice_number,subtotal_qar,discount_qar,total_qar,period_start,period_end,notes,status,issued_at)
 values(p_request_id,parent,student,'INV-'||to_char(now() at time zone 'Asia/Qatar','YYYY')||'-'||p_request_id::text,
 subtotal,discount,subtotal-discount,(p_invoice->>'period_start')::date,(p_invoice->>'period_end')::date,p_invoice->>'notes',coalesce(p_invoice->>'status','Draft'),case when p_invoice->>'status'='Issued' then now() end)
 returning * into result;
 insert into public.invoice_requests(id,payload) values(p_request_id,p_invoice);
 insert into public.billing_audit_events(actor_user_id,action,record_id) values(auth.uid(),'invoice_created',result.id);
 return result;
end $$;
create table public.invoice_requests(id uuid primary key references public.invoices(id),payload jsonb not null);
alter table public.invoice_requests enable row level security;
revoke all on public.invoice_requests from public,anon,authenticated;
revoke all on function public.create_invoice(uuid,jsonb) from public,anon;
grant execute on function public.create_invoice(uuid,jsonb) to authenticated;
revoke insert,delete,update on public.invoices from public,anon,authenticated;
-- Issuing/cancelling is the only client mutation; ledger amounts are RPC-owned.
grant update(status,issued_at,due_at) on public.invoices to authenticated;
create or replace function public.guard_invoice_status() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
  if coalesce(learnwise_private.active_profile_role() not in ('super_admin','admin_tutor'),true) then raise exception 'Active administrator required' using errcode='42501'; end if;
  if new.status='Cancelled' and learnwise_private.active_profile_role()<>'super_admin' then raise exception 'Tutor Admin cancellation authority is pending owner decision' using errcode='42501'; end if;
  if not ((old.status='Draft' and new.status in ('Draft','Issued','Cancelled'))
    or (old.status in ('Issued','Overdue') and old.paid_qar=0 and new.status in (old.status,'Cancelled')))
   then raise exception 'Unsupported invoice transition'; end if;
  if new.status='Issued' and old.status='Draft' then new.issued_at=now(); end if;
 end if;
 return new;
end $$;
create trigger guard_invoice_status before update on public.invoices for each row execute function public.guard_invoice_status();
revoke all on function public.guard_invoice_status() from public,anon,authenticated;
-- Cascading parent/student deletions must not erase or relink a posted payment.
create or replace function public.guard_posted_payment() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Posted payments are immutable; use a separately reviewed correction process' using errcode='42501'; end $$;
create trigger guard_posted_payment before update or delete on public.payments for each row execute function public.guard_posted_payment();
revoke all on function public.guard_posted_payment() from public,anon,authenticated;
commit;
notify pgrst,'reload schema';
