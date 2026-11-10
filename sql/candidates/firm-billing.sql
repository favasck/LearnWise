-- DRAFT ONLY. Local candidate after firm-access.sql, not a production rollout.
begin;
create function learnwise_private.money(v text,zero_ok boolean default false)returns numeric language plpgsql immutable set search_path='' as $$declare n numeric:=v::numeric;begin if n is null or n::text in('NaN','Infinity','-Infinity')or n<0 or(not zero_ok and n=0)or n<>round(n,2)or n>99999999.99 then raise exception 'Valid QAR amount with at most two decimals required';end if;return n;end$$;
create or replace function public.create_invoice(p_request_id uuid,p_invoice jsonb)returns public.invoices language plpgsql security definer set search_path='' as $$
declare result public.invoices;f uuid:=(p_invoice->>'firm_id')::uuid;parent uuid:=(p_invoice->>'parent_id')::uuid;student uuid:=(p_invoice->>'student_id')::uuid;subtotal numeric;discount numeric;begin
 if f is null or not learnwise_private.can(f,'issue_invoices')then raise exception 'Invoice permission required for this firm'using errcode='42501';end if;
 if p_request_id is null or jsonb_typeof(p_invoice)<>'object'or exists(select 1 from jsonb_object_keys(p_invoice)k where k not in('firm_id','parent_id','student_id','subtotal_qar','discount_qar','period_start','period_end','notes','status'))then raise exception 'Invalid invoice request';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into result from public.invoices where id=p_request_id;if found then if result.firm_id<>f or not exists(select 1 from public.invoice_requests where id=p_request_id and payload=p_invoice)then raise exception 'Request ID reused with different details';end if;return result;end if;
 subtotal:=learnwise_private.money(p_invoice->>'subtotal_qar');discount:=learnwise_private.money(coalesce(p_invoice->>'discount_qar','0'),true);if discount>=subtotal then raise exception 'Discount must be smaller than subtotal';end if;
 if not exists(select 1 from public.parents where id=parent and firm_id=f)or(student is not null and not exists(select 1 from public.students where id=student and parent_id=parent and firm_id=f))then raise exception 'Invoice relationship mismatch';end if;
 if coalesce(p_invoice->>'status','Draft')not in('Draft','Issued')or(p_invoice->>'period_end')::date<(p_invoice->>'period_start')::date then raise exception 'Invalid invoice status/period';end if;
 insert into public.invoices(id,firm_id,parent_id,student_id,invoice_number,subtotal_qar,discount_qar,total_qar,period_start,period_end,notes,status,issued_at)values(p_request_id,f,parent,student,'INV-'||p_request_id::text,subtotal,discount,subtotal-discount,(p_invoice->>'period_start')::date,(p_invoice->>'period_end')::date,p_invoice->>'notes',coalesce(p_invoice->>'status','Draft'),case when p_invoice->>'status'='Issued'then now()end)returning * into result;
 insert into public.invoice_requests(id,payload)values(p_request_id,p_invoice);return result;end$$;
create or replace function public.record_payment(p_request_id uuid,p_payment jsonb)returns public.payments language plpgsql security definer set search_path='' as $$
declare f uuid:=(p_payment->>'firm_id')::uuid;parent uuid:=(p_payment->>'parent_id')::uuid;student uuid:=(p_payment->>'student_id')::uuid;tutor uuid:=(p_payment->>'tutor_id')::uuid;invoice uuid:=(p_payment->>'invoice_id')::uuid;amount numeric;prior public.payments;inv public.invoices;result public.payments;begin
 if f is null or not learnwise_private.can(f,'record_payments')then raise exception 'Payment permission required for this firm'using errcode='42501';end if;
 if p_request_id is null or jsonb_typeof(p_payment)<>'object'or exists(select 1 from jsonb_object_keys(p_payment)k where k not in('firm_id','parent_id','student_id','tutor_id','invoice_id','amount_qar','method','reference','notes'))then raise exception 'Invalid payment request';end if;
 amount:=learnwise_private.money(p_payment->>'amount_qar');perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into prior from public.payments where id=p_request_id;if found then
 if prior.firm_id is distinct from f or prior.parent_id is distinct from parent or prior.student_id is distinct from student or prior.tutor_id is distinct from tutor or prior.invoice_id is distinct from invoice or prior.amount_qar<>amount or prior.method is distinct from p_payment->>'method'or prior.reference is distinct from p_payment->>'reference'or prior.notes is distinct from p_payment->>'notes'then raise exception 'Request ID reused with different details';end if;return prior;end if;
 if not exists(select 1 from public.parents where id=parent and firm_id=f)or(student is not null and not exists(select 1 from public.students where id=student and parent_id=parent and firm_id=f))then raise exception 'Payment relationship mismatch';end if;
 if invoice is not null then select * into inv from public.invoices where id=invoice for update;if not found or inv.firm_id is distinct from f or inv.parent_id<>parent or inv.student_id is distinct from student or inv.status not in('Issued','Partially Paid','Overdue')or amount>inv.total_qar-inv.paid_qar then raise exception 'Invoice unavailable or insufficient balance';end if;end if;
 insert into public.payments(id,firm_id,invoice_id,parent_id,student_id,tutor_id,amount_qar,method,reference,notes,status)values(p_request_id,f,invoice,parent,student,tutor,amount,p_payment->>'method',p_payment->>'reference',p_payment->>'notes','Recorded')returning * into result;
 if invoice is not null then update public.invoices set paid_qar=paid_qar+amount,status=case when paid_qar+amount=total_qar then 'Paid'else 'Partially Paid'end where id=invoice;end if;return result;end$$;
create function learnwise_private.invoice_void(i uuid,why text)returns public.invoices language plpgsql security definer set search_path='' as $$declare inv public.invoices;begin
 select * into inv from public.invoices where id=i for update;
 if inv.id is null or not learnwise_private.can(inv.firm_id,'void_invoices')then raise exception 'Void permission required for this firm'using errcode='42501';end if;
 if length(trim(coalesce(why,'')))<3 or inv.paid_qar<>0 then raise exception 'Reason and zero paid balance required; correct payments first';end if;
 if inv.status='Cancelled'then return inv;end if;
 perform set_config('learnwise.reason',why,true);update public.invoices set status='Cancelled'where id=i returning * into inv;return inv;end$$;
create function public.invoice_void(p_invoice_id uuid,p_reason text)returns public.invoices language sql security invoker set search_path='' as $$select learnwise_private.invoice_void(p_invoice_id,p_reason)$$;
create function learnwise_private.payment_correct(p uuid,new_value text,why text,request uuid)returns public.payment_adjustments language plpgsql security definer set search_path='' as $$
declare pay public.payments;inv public.invoices;result public.payment_adjustments;target numeric;prior numeric;delta numeric;begin
 select * into pay from public.payments where id=p for update;
 if pay.id is null or not learnwise_private.can(pay.firm_id,'correct_payments')then raise exception 'Correction permission required for this firm'using errcode='42501';end if;
 if pay.status<>'Recorded'then raise exception 'Only recorded payments can be corrected';end if;
 if length(trim(coalesce(why,'')))<3 or request is null then raise exception 'Correction reason and request ID required';end if;
 target:=learnwise_private.money(new_value,true);perform pg_advisory_xact_lock(hashtextextended(request::text,0));
 select * into result from public.payment_adjustments where id=request;if found then if result.payment_id<>p or result.new_amount<>target or result.reason<>why then raise exception 'Request ID reused with different details';end if;return result;end if;
 select pay.amount_qar+coalesce(sum(amount_delta),0)into prior from public.payment_adjustments where payment_id=p;delta:=target-prior;if delta=0 then raise exception 'Correction must change the amount';end if;
 if pay.invoice_id is not null then select * into inv from public.invoices where id=pay.invoice_id for update;if inv.status='Cancelled'or inv.paid_qar+delta<0 or inv.paid_qar+delta>inv.total_qar then raise exception 'Correction exceeds invoice bounds';end if;end if;
 perform set_config('learnwise.reason',why,true);insert into public.payment_adjustments(id,firm_id,payment_id,amount_delta,new_amount,reason,actor_user_id)values(request,pay.firm_id,p,delta,target,why,auth.uid())returning * into result;
 if pay.invoice_id is not null then update public.invoices set paid_qar=paid_qar+delta,status=case when paid_qar+delta=total_qar then 'Paid'when paid_qar+delta>0 then 'Partially Paid'else 'Issued'end where id=pay.invoice_id;end if;
 insert into public.firm_audit_events(firm_id,actor_user_id,action,table_name,record_id,reason,old_data,new_data)values(pay.firm_id,auth.uid(),'payment_corrected','payments',p,why,jsonb_build_object('effective_amount',prior),jsonb_build_object('effective_amount',target,'adjustment_id',request));return result;end$$;
create function public.payment_correct(p_payment_id uuid,p_new_amount text,p_reason text,p_request_id uuid)returns public.payment_adjustments language sql security invoker set search_path='' as $$select learnwise_private.payment_correct(p_payment_id,p_new_amount,p_reason,p_request_id)$$;
-- Client status/amount changes cannot bypass the audited billing API.
revoke update on public.invoices from public,anon,authenticated;
revoke update(status,issued_at,due_at)on public.invoices from public,anon,authenticated;
create function learnwise_private.invoice_issue(i uuid)returns public.invoices language plpgsql security definer set search_path='' as $$declare inv public.invoices;begin
 select * into inv from public.invoices where id=i for update;if inv.id is null or not learnwise_private.can(inv.firm_id,'issue_invoices')then raise exception 'Invoice permission required'using errcode='42501';end if;
 if inv.status<>'Draft'then raise exception 'Only draft invoices can be issued';end if;update public.invoices set status='Issued',issued_at=now()where id=i returning * into inv;return inv;end$$;
create function public.invoice_issue(p_invoice_id uuid)returns public.invoices language sql security invoker set search_path='' as $$select learnwise_private.invoice_issue(p_invoice_id)$$;
create function learnwise_private.keep_invoice_history()returns trigger language plpgsql set search_path='' as $$begin if old.status<>'Draft'then raise exception 'Issued invoice history is retained; void the invoice instead'using errcode='42501';end if;return old;end$$;
create trigger keep_invoice_history before delete on public.invoices for each row execute function learnwise_private.keep_invoice_history();
revoke all on function learnwise_private.keep_invoice_history()from public,anon,authenticated;
revoke all on function public.create_invoice(uuid,jsonb),public.record_payment(uuid,jsonb),public.invoice_void(uuid,text),public.payment_correct(uuid,text,text,uuid),public.invoice_issue(uuid)from public,anon;
grant execute on function public.create_invoice(uuid,jsonb),public.record_payment(uuid,jsonb),public.invoice_void(uuid,text),public.payment_correct(uuid,text,text,uuid),public.invoice_issue(uuid)to authenticated;
revoke all on function learnwise_private.money(text,boolean),learnwise_private.invoice_void(uuid,text),learnwise_private.payment_correct(uuid,text,text,uuid),learnwise_private.invoice_issue(uuid)from public,anon;
grant execute on function learnwise_private.money(text,boolean),learnwise_private.invoice_void(uuid,text),learnwise_private.payment_correct(uuid,text,text,uuid),learnwise_private.invoice_issue(uuid)to authenticated;

-- Parents and authorized billing users see effective amounts after adjustments,
-- while the immutable payment and adjustment history remains intact.
grant select(firm_id,payment_id,amount_delta,new_amount,created_at)on public.payment_adjustments to authenticated;
create policy adjustment_read on public.payment_adjustments for select to authenticated using(exists(select 1 from public.payments p where p.id=payment_adjustments.payment_id and p.firm_id=payment_adjustments.firm_id));
do $$declare projection text;r record;begin
 select string_agg(case attname when 'amount_qar'then 'p.amount_qar+coalesce((select sum(a.amount_delta)from public.payment_adjustments a where a.payment_id=p.id),0)as amount_qar'else 'p.'||quote_ident(attname)end,','order by attnum)into projection from pg_attribute where attrelid='public.payments'::regclass and attnum>0 and not attisdropped;
 execute 'create view public.payment_balances with(security_invoker=true,security_barrier=true)as select '||projection||',p.amount_qar as original_amount_qar from public.payments p';
 for r in select * from(values('parents','parent_id'),('students','student_id'),('tutors','tutor_id'),('invoices','invoice_id'))as relations(target,col)loop
  execute format('create function public.%I(public.payment_balances)returns setof public.%I rows 1 language sql stable security invoker set search_path='''' as %L',r.target,r.target,format('select x.* from public.%I x where x.id=$1.%I and x.firm_id is not distinct from $1.firm_id',r.target,r.col));
  execute format('revoke all on function public.%I(public.payment_balances)from public,anon',r.target);execute format('grant execute on function public.%I(public.payment_balances)to authenticated',r.target);
 end loop;
end$$;
revoke all on public.payment_balances from public,anon;grant select on public.payment_balances to authenticated;
drop function public.payments(public.invoices);
create function public.payments(public.invoices)returns setof public.payment_balances language sql stable security invoker set search_path='' as $$select x.* from public.payment_balances x where x.invoice_id=$1.id and x.firm_id is not distinct from $1.firm_id$$;
revoke all on function public.payments(public.invoices)from public,anon;grant execute on function public.payments(public.invoices)to authenticated;
commit;
notify pgrst,'reload schema';
