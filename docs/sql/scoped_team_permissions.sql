-- Scoped teams, retained deletions and server-authored change history.
-- Applied transactionally through Supabase migrations after policy tests.
create schema if not exists learnwise_private;
revoke all on schema learnwise_private from public;
grant usage on schema learnwise_private to authenticated;

do $$ declare tab text; begin
  foreach tab in array array['tutors','students','parents','classes','student_tutors','class_notes','homework','materials','invoices','payments','assessment_requests'] loop
    execute format('alter table public.%I add column if not exists owner_user_id uuid references auth.users(id) default auth.uid(), add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references auth.users(id), add column if not exists edited_at timestamptz, add column if not exists edited_by uuid references auth.users(id)',tab);
    execute format('create index if not exists %I on public.%I(owner_user_id)',tab||'_owner_scope_idx',tab);
  end loop;
end $$;
alter table public.tutors add column if not exists managed_by_user_id uuid references auth.users(id);
alter table public.payments add column if not exists status text not null default 'Recorded';
create index if not exists tutors_manager_scope_idx on public.tutors(managed_by_user_id);
create index if not exists student_tutors_scope_idx on public.student_tutors(tutor_id,student_id) where is_active;
create index if not exists students_parent_scope_idx on public.students(parent_id);
-- Replaced by scoped_guard, including the tutor attendance-only restriction.
drop trigger if exists guard_class_update on public.classes;

create or replace function learnwise_private.actor_role() returns text
language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=auth.uid() and status='Active'
$$;
create or replace function learnwise_private.is_root() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(learnwise_private.actor_role() in ('super_admin','admin'),false)
$$;
create or replace function learnwise_private.is_staff() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(learnwise_private.actor_role() in ('super_admin','admin','admin_tutor'),false)
$$;
create or replace function learnwise_private.tutor_scope(tid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select learnwise_private.is_root() or exists (
   select 1 from public.tutors t where t.id=tid and learnwise_private.actor_role() in ('tutor','admin_tutor')
   and (t.user_id=auth.uid() or (learnwise_private.actor_role()='admin_tutor' and t.managed_by_user_id=auth.uid()))
 )
$$;
create or replace function learnwise_private.owner_scope(uid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select learnwise_private.is_root() or (learnwise_private.is_staff() and
 (uid=auth.uid() or exists(select 1 from public.tutors t where t.user_id=uid and t.managed_by_user_id=auth.uid())))
$$;
create or replace function learnwise_private.family_student(sid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.students s left join public.parents p on p.id=s.parent_id
 where s.id=sid and s.deleted_at is null and
 ((learnwise_private.actor_role()='student' and s.user_id=auth.uid()) or
 (learnwise_private.actor_role()='parent' and p.user_id=auth.uid() and p.deleted_at is null)))
$$;
create or replace function learnwise_private.student_scope(sid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select learnwise_private.is_root() or learnwise_private.family_student(sid) or exists (
 select 1 from public.students s where s.id=sid and (
 learnwise_private.owner_scope(s.owner_user_id) or exists (
 select 1 from public.student_tutors st join public.tutors t on t.id=st.tutor_id
 where st.student_id=sid and st.is_active and st.deleted_at is null and t.deleted_at is null and learnwise_private.tutor_scope(t.id))
 or (learnwise_private.actor_role() in ('tutor','admin_tutor') and exists (
 select 1 from public.classes c where c.student_id=sid and learnwise_private.tutor_scope(c.tutor_id)
 and not exists(select 1 from public.student_tutors st where st.student_id=sid and st.tutor_id=c.tutor_id))))
 )
$$;
create or replace function learnwise_private.parent_scope(pid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select learnwise_private.is_root() or exists(select 1 from public.parents p where p.id=pid and (
 learnwise_private.owner_scope(p.owner_user_id) or
 (learnwise_private.actor_role()='parent' and p.user_id=auth.uid()) or
 exists(select 1 from public.students s where s.parent_id=pid and learnwise_private.student_scope(s.id))))
$$;
create or replace function learnwise_private.can_read(tab text,r jsonb) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare tid uuid := (r->>'tutor_id')::uuid; sid uuid := (r->>'student_id')::uuid;
begin
 if tab='profiles' and (r->>'id')::uuid=auth.uid() then return true; end if;
 if learnwise_private.actor_role() is null then return false; end if;
 if learnwise_private.is_root() then return true; end if;
 if r->>'deleted_at' is not null and learnwise_private.actor_role() in ('parent','student') then return false; end if;
 case tab
 when 'profiles' then return learnwise_private.actor_role()='admin_tutor' and (
 exists(select 1 from public.tutors t where t.user_id=(r->>'id')::uuid and learnwise_private.tutor_scope(t.id)) or
 exists(select 1 from public.students s where s.user_id=(r->>'id')::uuid and learnwise_private.student_scope(s.id)) or
 exists(select 1 from public.parents p where p.user_id=(r->>'id')::uuid and learnwise_private.parent_scope(p.id)));
 when 'tutors' then return (learnwise_private.actor_role() in ('tutor','admin_tutor') and ((r->>'user_id')::uuid=auth.uid() or (learnwise_private.actor_role()='admin_tutor' and (r->>'managed_by_user_id')::uuid=auth.uid()))) or learnwise_private.tutor_scope((r->>'id')::uuid) or
 exists(select 1 from public.student_tutors st where st.tutor_id=(r->>'id')::uuid and st.is_active and st.deleted_at is null and learnwise_private.family_student(st.student_id));
 when 'students' then return learnwise_private.owner_scope((r->>'owner_user_id')::uuid) or learnwise_private.student_scope((r->>'id')::uuid);
 when 'parents' then return learnwise_private.owner_scope((r->>'owner_user_id')::uuid) or learnwise_private.parent_scope((r->>'id')::uuid);
 when 'student_tutors' then return (learnwise_private.tutor_scope(tid) and learnwise_private.student_scope(sid)) or learnwise_private.family_student(sid);
 when 'classes','homework','class_notes','materials' then
   if tab='materials' and tid is null then return learnwise_private.owner_scope((r->>'owner_user_id')::uuid); end if;
   if learnwise_private.tutor_scope(tid) and (sid is null or learnwise_private.student_scope(sid)) then return true; end if;
   if not learnwise_private.family_student(sid) then return false; end if;
   if tab='class_notes' then return case when learnwise_private.actor_role()='parent' then (r->>'is_shared_with_parent')::boolean else (r->>'is_shared_with_student')::boolean end; end if;
   return true;
 when 'invoices','payments' then return learnwise_private.owner_scope((r->>'owner_user_id')::uuid) or
 (learnwise_private.actor_role()='parent' and exists(select 1 from public.parents p where p.id=(r->>'parent_id')::uuid and p.user_id=auth.uid()));
 when 'assessment_requests' then return learnwise_private.owner_scope((r->>'owner_user_id')::uuid);
 else return false;
 end case;
end $$;
create or replace function learnwise_private.can_write(tab text,r jsonb) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare tid uuid := (r->>'tutor_id')::uuid; sid uuid := (r->>'student_id')::uuid;
begin
 if learnwise_private.actor_role() is null then return false; end if;
 if learnwise_private.is_root() then return true; end if;
 case tab
 when 'profiles' then return (r->>'id')::uuid=auth.uid();
 when 'tutors' then return learnwise_private.actor_role()='admin_tutor' and
 ((r->>'user_id')::uuid=auth.uid() or (r->>'managed_by_user_id')::uuid=auth.uid());
 when 'students' then return learnwise_private.is_staff() and
 (learnwise_private.owner_scope((r->>'owner_user_id')::uuid) or learnwise_private.student_scope((r->>'id')::uuid));
 when 'parents' then return learnwise_private.is_staff() and
 (learnwise_private.owner_scope((r->>'owner_user_id')::uuid) or learnwise_private.parent_scope((r->>'id')::uuid));
 when 'student_tutors' then return learnwise_private.is_staff() and learnwise_private.tutor_scope(tid) and learnwise_private.student_scope(sid);
 when 'classes','homework','class_notes','materials' then
   if tab='materials' and tid is null then return learnwise_private.owner_scope((r->>'owner_user_id')::uuid) and (sid is null or learnwise_private.student_scope(sid)); end if;
   if not learnwise_private.tutor_scope(tid) then return false; end if;
   if sid is null then return tab='materials'; end if;
   if not learnwise_private.student_scope(sid) then return false; end if;
   if learnwise_private.is_staff() then return true; end if;
   return exists(select 1 from public.student_tutors st where st.student_id=sid and st.tutor_id=tid and st.is_active and st.deleted_at is null);
 when 'invoices','payments' then return learnwise_private.is_staff() and learnwise_private.owner_scope((r->>'owner_user_id')::uuid)
   and learnwise_private.parent_scope((r->>'parent_id')::uuid)
   and (sid is null or learnwise_private.student_scope(sid)) and (tid is null or learnwise_private.tutor_scope(tid));
 when 'assessment_requests' then return learnwise_private.is_staff() and learnwise_private.owner_scope((r->>'owner_user_id')::uuid);
 else return false;
 end case;
end $$;

-- Guards apply even if a client sends columns absent from the interface.
create or replace function learnwise_private.guard_record() returns trigger
language plpgsql set search_path='' as $$
declare nr jsonb; orow jsonb; uid uuid:=auth.uid(); role_name text:=learnwise_private.actor_role();
begin
 if current_user not in ('authenticated','anon') then return new; end if;
 if tg_op='DELETE' then raise exception 'Use retained deletion instead of permanent deletion'; end if;
 nr:=to_jsonb(new);
 if tg_table_name='students' and nr->>'parent_id' is not null and not learnwise_private.parent_scope((nr->>'parent_id')::uuid) then raise exception 'Parent is outside your work'; end if;
 if tg_table_name in ('classes','class_notes','homework','materials','student_tutors') and nr->>'tutor_id' is not null and not exists(select 1 from public.tutors t where t.id=(nr->>'tutor_id')::uuid and t.deleted_at is null) then raise exception 'Tutor is deleted or unavailable'; end if;
 if tg_table_name='profiles' then
   if tg_op='INSERT' then raise exception 'Accounts are created through signup'; end if;
   if not learnwise_private.is_root() and (nr-array['full_name','phone','updated_at']) is distinct from (to_jsonb(old)-array['full_name','phone','updated_at']) then raise exception 'Only name and phone may be changed'; end if;
   return new;
 end if;
 if tg_op='INSERT' then
   if tg_table_name='assessment_requests' and not learnwise_private.is_staff() then
     new.owner_user_id:=null;
     return new;
   end if;
   if new.owner_user_id is distinct from uid and not learnwise_private.is_root() then raise exception 'Cannot assign another owner'; end if;
   if nr->>'deleted_at' is not null or nr->>'edited_at' is not null or nr->>'deleted_by' is not null or nr->>'edited_by' is not null then raise exception 'History is server authored'; end if;
   if tg_table_name='tutors' and role_name='admin_tutor' then new:=jsonb_populate_record(new,jsonb_build_object('managed_by_user_id',uid)); end if;
 else
   orow:=to_jsonb(old);
   if old.deleted_at is not null then raise exception 'Deleted records are read-only'; end if;
   if (nr-array['updated_at','edited_at','edited_by','deleted_at','deleted_by']) = (orow-array['updated_at','edited_at','edited_by','deleted_at','deleted_by']) and nr->>'deleted_at' is null then return old; end if;
   if not learnwise_private.is_root() and (nr->'owner_user_id' is distinct from orow->'owner_user_id' or nr->'user_id' is distinct from orow->'user_id' or nr->'id' is distinct from orow->'id' or nr->'managed_by_user_id' is distinct from orow->'managed_by_user_id') then raise exception 'Cannot reassign ownership or team'; end if;
   new.edited_at:=clock_timestamp(); new.edited_by:=uid;
   new.deleted_by:=old.deleted_by;
   if new.deleted_at is not null then new.deleted_at:=clock_timestamp(); new.deleted_by:=uid; end if;
   if tg_table_name='classes' and role_name='tutor' and (nr-array['attendance','status','updated_at','edited_at','edited_by']) is distinct from (orow-array['attendance','status','updated_at','edited_at','edited_by']) then raise exception 'Tutors may update class attendance and status only'; end if;
 end if;
 nr:=to_jsonb(new);
 if tg_table_name='tutors' and nr->>'managed_by_user_id' is not null and not exists(select 1 from public.profiles p where p.id=(nr->>'managed_by_user_id')::uuid and p.role='admin_tutor' and p.status='Active') then raise exception 'Team manager must be an active Admin Tutor'; end if;
 if tg_table_name='classes' and role_name='tutor' and tg_op='INSERT' then raise exception 'Tutors cannot schedule new classes'; end if;
 if tg_table_name in ('classes','class_notes','homework','materials') and nr->>'class_id' is not null and not exists(select 1 from public.classes c where c.id=(nr->>'class_id')::uuid and c.tutor_id=(nr->>'tutor_id')::uuid and c.student_id=(nr->>'student_id')::uuid and c.deleted_at is null) then raise exception 'Linked class does not match tutor and student'; end if;
 if tg_table_name in ('invoices','payments') and nr->>'student_id' is not null and not exists(select 1 from public.students s where s.id=(nr->>'student_id')::uuid and s.parent_id=(nr->>'parent_id')::uuid) then raise exception 'Student does not belong to parent'; end if;
 if tg_table_name='invoices' then
   if tg_op='INSERT' and coalesce((nr->>'paid_qar')::numeric,0)<>0 then raise exception 'Paid total is calculated from payments'; end if;
   if tg_op='UPDATE' and nr->'paid_qar' is distinct from to_jsonb(old)->'paid_qar' then raise exception 'Paid total is calculated from payments'; end if;
 end if;
 if tg_table_name='payments' then
   if (nr->>'amount_qar')::numeric<=0 then raise exception 'Payment amount must be positive'; end if;
   if nr->>'invoice_id' is not null then
     perform 1 from public.invoices where id=(nr->>'invoice_id')::uuid for update;
     if not exists(select 1 from public.invoices i where i.id=(nr->>'invoice_id')::uuid and i.parent_id=(nr->>'parent_id')::uuid and i.student_id is not distinct from (nr->>'student_id')::uuid and i.deleted_at is null and i.status not in ('Voided','Cancelled') and learnwise_private.can_write('invoices',to_jsonb(i))) then raise exception 'Invoice is unavailable or outside your work'; end if;
   end if;
 end if;
 return new;
end $$;
create or replace function learnwise_private.audit_record() returns trigger
language plpgsql security definer set search_path='' as $$
declare nr jsonb:=to_jsonb(new); prior jsonb;
begin
 if tg_op='UPDATE' then prior:=to_jsonb(old); if nr=prior then return new; end if; end if;
 insert into public.audit_logs(actor_user_id,actor_role,action,table_name,record_id,old_data,new_data,module,created_at)
 values(auth.uid(),learnwise_private.actor_role(),case when tg_op='INSERT' then 'created' when tg_table_name='profiles' and nr->'role' is distinct from prior->'role' then 'change_role' when nr->>'deleted_at' is not null and prior->>'deleted_at' is null then 'deleted' else 'edited' end,tg_table_name,(nr->>'id')::uuid,prior,nr,tg_table_name,clock_timestamp());
 return new;
end $$;
create or replace function learnwise_private.recalculate_invoice() returns trigger
language plpgsql security definer set search_path='' as $$
declare invoice_id_value uuid; old_invoice uuid; total_paid numeric;
begin
 if tg_op='UPDATE' then old_invoice:=old.invoice_id; end if;
 for invoice_id_value in select distinct id from unnest(array[new.invoice_id,old_invoice]) id where id is not null order by id loop
   perform 1 from public.invoices where id=invoice_id_value for update;
   select coalesce(sum(amount_qar),0) into total_paid from public.payments where invoice_id=invoice_id_value and deleted_at is null and status='Recorded';
   update public.invoices set paid_qar=total_paid,status=case when deleted_at is not null or status in ('Voided','Cancelled') then status when total_paid>=total_qar then 'Paid' when total_paid>0 then 'Partially Paid' else case when issued_at is null then 'Draft' else 'Issued' end end,updated_at=now() where id=invoice_id_value;
 end loop;
 return new;
end $$;

do $$ declare tab text; p record; begin
 foreach tab in array array['profiles','tutors','students','parents','student_tutors','classes','class_notes','homework','materials','invoices','payments','assessment_requests'] loop
   for p in select policyname from pg_policies where schemaname='public' and tablename=tab loop execute format('drop policy %I on public.%I',p.policyname,tab); end loop;
   execute format('alter table public.%I enable row level security',tab);
   execute format('create policy scoped_read on public.%I for select to authenticated using (learnwise_private.can_read(%L,to_jsonb(%I)))',tab,tab,tab);
   execute format('create policy scoped_insert on public.%I for insert to authenticated with check (learnwise_private.can_write(%L,to_jsonb(%I)))',tab,tab,tab);
   execute format('create policy scoped_update on public.%I for update to authenticated using (learnwise_private.can_write(%L,to_jsonb(%I))) with check (learnwise_private.can_write(%L,to_jsonb(%I)))',tab,tab,tab,tab,tab);
   execute format('drop trigger if exists scoped_guard on public.%I',tab);
   execute format('create trigger scoped_guard before insert or update or delete on public.%I for each row execute function learnwise_private.guard_record()',tab);
   execute format('drop trigger if exists scoped_audit on public.%I',tab);
   execute format('create trigger scoped_audit after insert or update on public.%I for each row execute function learnwise_private.audit_record()',tab);
   execute format('grant select,insert,update on public.%I to authenticated',tab);
   execute format('revoke delete on public.%I from authenticated,anon',tab);
 end loop;
end $$;
-- Parent/student inserts are limited to public enquiry fields.
create policy public_enquiry on public.assessment_requests for insert to anon,authenticated
with check (status='New' and admin_notes is null and deleted_at is null and deleted_by is null and edited_at is null and edited_by is null and owner_user_id is null);
grant insert(parent_name,parent_email,parent_phone,student_name,student_age,student_grade,school,curriculum,subjects,goals,preferred_mode,message) on public.assessment_requests to anon;

do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='audit_logs' loop execute format('drop policy %I on public.audit_logs',p.policyname); end loop;
end $$;
alter table public.audit_logs enable row level security;
create or replace function learnwise_private.audit_scope(tab text,rid uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare allowed boolean;
begin
 if learnwise_private.is_root() then return true; end if;
 if not learnwise_private.is_staff() or tab<>all(array['profiles','tutors','students','parents','classes','student_tutors','class_notes','homework','materials','invoices','payments','assessment_requests']) then return false; end if;
 execute format('select learnwise_private.can_read(%L,to_jsonb(r)) from public.%I r where r.id=$1',tab,tab) into allowed using rid;
 return coalesce(allowed,false);
end $$;
create policy scope_audit_read on public.audit_logs for select to authenticated using(learnwise_private.audit_scope(table_name,record_id));
revoke insert,update,delete on public.audit_logs from anon,authenticated;
grant select on public.audit_logs to authenticated;
drop trigger if exists scoped_payment_totals on public.payments;
create trigger scoped_payment_totals after insert or update on public.payments for each row execute function learnwise_private.recalculate_invoice();

-- Public compatibility helpers must no longer grant global Admin Tutor access.
create or replace function public.get_my_role() returns text language sql stable security definer set search_path='' as $$ select learnwise_private.actor_role() $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select learnwise_private.is_root() $$;
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$ select learnwise_private.is_root() $$;
create or replace function public.is_admin_tutor() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(learnwise_private.actor_role()='admin_tutor',false) $$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path='' as $$ select learnwise_private.is_staff() $$;

create or replace function public.admin_update_profile(p_user_id uuid,p_updates jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare before_row public.profiles; after_row public.profiles; target_role text; tab text;
begin
 if not learnwise_private.is_root() then raise exception 'Only a Super Admin can change account roles or status'; end if;
 if p_user_id=auth.uid() then raise exception 'You cannot change your own account permissions'; end if;
 if p_updates is null or jsonb_typeof(p_updates)<>'object' or p_updates='{}'::jsonb or exists(select 1 from jsonb_object_keys(p_updates) k where k not in ('role','status')) then raise exception 'Only role and status may be updated here'; end if;
 if p_updates ? 'role' and coalesce(p_updates->>'role','') not in ('super_admin','admin_tutor','tutor','parent','student') then raise exception 'Invalid role'; end if;
 if p_updates ? 'status' and coalesce(p_updates->>'status','') not in ('Active','Suspended') then raise exception 'Invalid account status'; end if;
 select * into before_row from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Account not found'; end if;
 update public.profiles set role=coalesce(p_updates->>'role',role),status=coalesce(p_updates->>'status',status),updated_at=now() where id=p_user_id returning * into after_row;
 target_role:=after_row.role;
 if target_role in ('admin_tutor','tutor','parent','student') then
   tab:=case when target_role in ('tutor','admin_tutor') then 'tutors' when target_role='parent' then 'parents' else 'students' end;
   execute format('insert into public.%I(user_id,full_name,email,phone,owner_user_id) select $1,$2,$3,$4,$5 where not exists(select 1 from public.%I where user_id=$1)',tab,tab)
   using p_user_id,after_row.full_name,after_row.email,after_row.phone,auth.uid();
 end if;
 return to_jsonb(after_row);
end $$;
revoke all on function public.admin_update_profile(uuid,jsonb) from public,anon;
grant execute on function public.admin_update_profile(uuid,jsonb) to authenticated;

create sequence if not exists learnwise_private.invoice_number_seq;
do $$ declare next_number bigint; current_number bigint; begin
 select coalesce(max(substring(invoice_number from '([0-9]+)$')::bigint),0)+1 into next_number from public.invoices;
 select last_value into current_number from learnwise_private.invoice_number_seq;
 perform setval('learnwise_private.invoice_number_seq',greatest(next_number,current_number),false);
end $$;
create or replace function public.next_invoice_number() returns text
language plpgsql security definer set search_path='' as $$
begin
 if not learnwise_private.is_staff() then raise exception 'Unauthorized'; end if;
 return 'INV-'||extract(year from current_date)::text||'-'||lpad(nextval('learnwise_private.invoice_number_seq')::text,6,'0');
end $$;
revoke all on function public.next_invoice_number() from public,anon;
grant execute on function public.next_invoice_number() to authenticated;

create or replace function learnwise_private.sync_personal_details() returns trigger
language plpgsql security definer set search_path='' as $$
declare tab text;
begin
 if new.full_name is not distinct from old.full_name and new.phone is not distinct from old.phone then return new; end if;
 foreach tab in array array['tutors','parents','students'] loop
   execute format('update public.%I set full_name=$1,phone=$2 where user_id=$3 and deleted_at is null',tab) using new.full_name,new.phone,new.id;
 end loop;
 return new;
end $$;
drop trigger if exists sync_personal_details on public.profiles;
create trigger sync_personal_details after update of full_name,phone on public.profiles for each row execute function learnwise_private.sync_personal_details();

do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime' and not puballtables)
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles') then
   alter publication supabase_realtime add table public.profiles;
 end if;
end $$;

-- Retain the existing payment RPC signature while enforcing RLS and trusted actor attribution.
create or replace function public.record_payment(p_invoice_id uuid,p_parent_id uuid,p_student_id uuid,p_tutor_id uuid,p_amount_qar numeric,p_method text,p_reference text,p_notes text,p_actor_user_id uuid,p_actor_role text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare payment_id uuid;
begin
 if not learnwise_private.is_staff() then raise exception 'Unauthorized'; end if;
 if p_invoice_id is not null then perform 1 from public.invoices where id=p_invoice_id and deleted_at is null for update; if not found then raise exception 'Invoice is outside your work'; end if; end if;
 insert into public.payments(invoice_id,parent_id,student_id,tutor_id,amount_qar,method,reference,notes) values(p_invoice_id,p_parent_id,p_student_id,p_tutor_id,p_amount_qar,p_method,p_reference,p_notes) returning id into payment_id;
 return jsonb_build_object('success',true,'payment_id',payment_id);
end $$;
revoke all on all functions in schema learnwise_private from public,anon;
grant execute on all functions in schema learnwise_private to authenticated;
revoke all on function public.record_payment(uuid,uuid,uuid,uuid,numeric,text,text,text,uuid,text) from public,anon;
grant execute on function public.record_payment(uuid,uuid,uuid,uuid,numeric,text,text,text,uuid,text) to authenticated;

-- Existing historical invoices without reliable ownership remain Super Admin-only.
-- No existing tutor is assigned to a manager implicitly.
