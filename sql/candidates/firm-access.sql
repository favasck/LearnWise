-- DRAFT ONLY. Local test candidate, not a production migration or rollout order.
-- Requires the exact exported-policy fixture and the earlier profile/billing
-- candidates in tests. Existing accounts/records are NOT assigned to firms.
begin;
create table public.firms(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name))between 1 and 120),active boolean not null default true,created_at timestamptz not null default now());
create table public.firm_memberships(firm_id uuid not null references public.firms(id),user_id uuid not null references public.profiles(id),role text not null check(role in('admin','tutor')),permissions text[] not null default '{}',active boolean not null default true,primary key(firm_id,user_id));
create table public.firm_audit_events(id uuid primary key default gen_random_uuid(),firm_id uuid references public.firms(id),actor_user_id uuid,action text not null,table_name text not null,record_id uuid,reason text,old_data jsonb,new_data jsonb,occurred_at timestamptz not null default now());
create table public.firm_invitations(id uuid primary key default gen_random_uuid(),firm_id uuid not null references public.firms(id),kind text not null check(kind in('student','parent')),record_id uuid not null,email text not null,token_hash text not null unique,expires_at timestamptz not null,accepted_by uuid,accepted_at timestamptz,created_by uuid not null references public.profiles(id));
create table public.payment_adjustments(id uuid primary key,firm_id uuid not null references public.firms(id),payment_id uuid not null references public.payments(id),amount_delta numeric(10,2) not null,new_amount numeric(10,2) not null,reason text not null,actor_user_id uuid not null,created_at timestamptz not null default now());
do $$declare t text;begin
 foreach t in array array['students','parents','tutors','student_tutors','classes','class_notes','homework','materials','invoices','payments','assessment_requests','audit_logs']loop
  execute format('alter table public.%I add column firm_id uuid references public.firms(id)',t);
  execute format('create index %I on public.%I(firm_id)',t||'_firm_idx',t);
 end loop;
 foreach t in array array['students','parents']loop execute format('alter table public.%I add column created_by uuid',t);end loop;
 foreach t in array array['students','parents','tutors']loop execute format('create unique index %I on public.%I(firm_id,user_id)where user_id is not null',t||'_firm_user_unique',t);end loop;
end$$;

-- Composite foreign keys enforce firm consistency under concurrency too.
do $$declare t text;r record;begin
 foreach t in array array['parents','students','tutors','classes','invoices']loop execute format('create unique index %I on public.%I(id,firm_id)',t||'_id_firm_unique',t);end loop;
 for r in select * from(values('students','parent_id','parents'),('student_tutors','student_id','students'),('student_tutors','tutor_id','tutors'),('classes','student_id','students'),('classes','tutor_id','tutors'),('class_notes','student_id','students'),('class_notes','tutor_id','tutors'),('class_notes','class_id','classes'),('homework','student_id','students'),('homework','tutor_id','tutors'),('homework','class_id','classes'),('materials','student_id','students'),('materials','tutor_id','tutors'),('materials','class_id','classes'),('invoices','parent_id','parents'),('invoices','student_id','students'),('payments','parent_id','parents'),('payments','student_id','students'),('payments','tutor_id','tutors'),('payments','invoice_id','invoices'))as links(tab,col,target)loop
  execute format('alter table public.%I add constraint %I foreign key(%I,firm_id)references public.%I(id,firm_id)deferrable initially immediate',r.tab,r.tab||'_'||r.col||'_firm_fk',r.col,r.target);
 end loop;
end$$;

-- Explicit computed relationships avoid ambiguity between the original foreign
-- keys and the additional firm-consistency keys in PostgREST embedded reads.
do $$declare r record;begin
 for r in select * from(values('students','parent_id','parents'),('student_tutors','student_id','students'),('student_tutors','tutor_id','tutors'),('classes','student_id','students'),('classes','tutor_id','tutors'),('class_notes','student_id','students'),('class_notes','tutor_id','tutors'),('class_notes','class_id','classes'),('homework','student_id','students'),('homework','tutor_id','tutors'),('homework','class_id','classes'),('materials','student_id','students'),('materials','tutor_id','tutors'),('materials','class_id','classes'),('invoices','parent_id','parents'),('invoices','student_id','students'),('payments','parent_id','parents'),('payments','student_id','students'),('payments','tutor_id','tutors'),('payments','invoice_id','invoices'))as links(tab,col,target)loop
  execute format('create function public.%I(public.%I)returns setof public.%I rows 1 language sql stable security invoker set search_path='''' as %L',r.target,r.tab,r.target,format('select x.* from public.%I x where x.id=$1.%I and x.firm_id is not distinct from $1.firm_id',r.target,r.col));
  execute format('create function public.%I(public.%I)returns setof public.%I language sql stable security invoker set search_path='''' as %L',r.tab,r.target,r.tab,format('select x.* from public.%I x where x.%I=$1.id and x.firm_id is not distinct from $1.firm_id',r.tab,r.col));
  execute format('revoke all on function public.%I(public.%I),public.%I(public.%I)from public,anon',r.target,r.tab,r.tab,r.target);
  execute format('grant execute on function public.%I(public.%I),public.%I(public.%I)to authenticated',r.target,r.tab,r.tab,r.target);
 end loop;
end$$;

create or replace function learnwise_private.super()returns boolean language sql stable security definer set search_path='' as $$select coalesce(learnwise_private.active_profile_role()='super_admin',false)$$;
create or replace function learnwise_private.can(f uuid,cap text)returns boolean language sql stable security definer set search_path='' as $$
 select learnwise_private.super() or (learnwise_private.active_profile_role()is not null and exists(select 1 from public.firm_memberships m join public.firms x on x.id=m.firm_id where m.firm_id=f and m.user_id=auth.uid()and m.active and x.active and cap=any(m.permissions)))$$;
create or replace function learnwise_private.tutor_in(f uuid)returns boolean language sql stable security definer set search_path='' as $$
 select learnwise_private.active_profile_role()is not null and exists(select 1 from public.firm_memberships m join public.firms x on x.id=m.firm_id join public.tutors t on t.firm_id=m.firm_id and t.user_id=m.user_id where m.firm_id=f and m.user_id=auth.uid()and m.role='tutor'and m.active and x.active and t.status='Active')$$;
create or replace function learnwise_private.owns_tutor(f uuid,t uuid)returns boolean language sql stable security definer set search_path='' as $$select learnwise_private.tutor_in(f)and exists(select 1 from public.tutors where id=t and firm_id=f and user_id=auth.uid()and status='Active')$$;
create or replace function learnwise_private.teaches(f uuid,t uuid,s uuid)returns boolean language sql stable security definer set search_path='' as $$select learnwise_private.owns_tutor(f,t)and exists(select 1 from public.student_tutors st join public.students s on s.id=st.student_id where st.firm_id=f and st.tutor_id=t and st.student_id=s.id and s.id=$3 and s.firm_id=f and st.is_active and s.status='Active')$$;
create or replace function learnwise_private.family_student(f uuid,s uuid)returns boolean language sql stable security definer set search_path='' as $$select learnwise_private.active_profile_role()is not null and exists(select 1 from public.students s left join public.parents p on p.id=s.parent_id and p.firm_id=s.firm_id where s.id=$2 and s.firm_id=$1 and(s.user_id=auth.uid()or p.user_id=auth.uid()))$$;
create or replace function learnwise_private.assigned_student(f uuid,s uuid)returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.student_tutors st where st.firm_id=f and st.student_id=s and st.is_active and learnwise_private.teaches(f,st.tutor_id,s))$$;
create or replace function learnwise_private.row_access(t text,j jsonb,op text)returns boolean language plpgsql stable security definer set search_path='' as $$
declare f uuid:=(j->>'firm_id')::uuid;r uuid:=(j->>'id')::uuid;s uuid:=(j->>'student_id')::uuid;tu uuid:=(j->>'tutor_id')::uuid;cap text;family boolean;
begin
 if learnwise_private.super()then return true;end if;
 if learnwise_private.active_profile_role()is null then return false;end if;
 if t='profiles'then
  if r=auth.uid()then return op in('select','update');end if;
  if op<>'select'then return false;end if;
  return exists(select 1 from public.firm_memberships m where learnwise_private.can(m.firm_id,'view_roster')and exists(select 1 from public.students x where x.firm_id=m.firm_id and x.user_id=r union all select 1 from public.parents x where x.firm_id=m.firm_id and x.user_id=r union all select 1 from public.tutors x where x.firm_id=m.firm_id and x.user_id=r));
 end if;
 if op='delete'or f is null then return false;end if;
 if not exists(select 1 from public.firms where id=f and active)then return false;end if;
 if t in('invoices','payments')then
  if op<>'select'then return false;end if;
  return learnwise_private.can(f,'view_billing')or learnwise_private.can(f,'issue_invoices')or learnwise_private.can(f,'record_payments')or learnwise_private.can(f,'void_invoices')or learnwise_private.can(f,'correct_payments')or exists(select 1 from public.parents p where p.id=(j->>'parent_id')::uuid and p.firm_id=f and p.user_id=auth.uid());
 end if;
 if t='audit_logs'then return false;end if;
 if t='assessment_requests'then return learnwise_private.can(f,'manage_roster');end if;
 if t in('students','parents','tutors','student_tutors')then
  cap:=case when t='tutors'then 'manage_tutors'else 'manage_roster'end;
  if learnwise_private.can(f,cap)or(op='select'and learnwise_private.can(f,'view_roster'))then return true;end if;
  if op<>'select'then return false;end if;
  if t='students'then return (j->>'user_id')::uuid=auth.uid()or learnwise_private.family_student(f,r)or learnwise_private.assigned_student(f,r);end if;
  if t='parents'then return (j->>'user_id')::uuid=auth.uid()or(learnwise_private.tutor_in(f)and(j->>'created_by')::uuid=auth.uid())or exists(select 1 from public.students st where st.firm_id=f and st.parent_id=r and learnwise_private.assigned_student(f,st.id));end if;
  if t='tutors'then return learnwise_private.owns_tutor(f,r)or exists(select 1 from public.student_tutors st where st.firm_id=f and st.tutor_id=r and st.is_active and learnwise_private.family_student(f,st.student_id));end if;
  return learnwise_private.owns_tutor(f,tu)or learnwise_private.family_student(f,s);
 end if;
 if learnwise_private.can(f,'manage_academic')then return true;end if;
 if t='materials'and s is null then
  if learnwise_private.owns_tutor(f,tu)then return true;end if;
  return op='select'and coalesce((j->>'is_public')::boolean,false)and exists(select 1 from public.students st where st.firm_id=f and learnwise_private.family_student(f,st.id));
 end if;
 if learnwise_private.teaches(f,tu,s)then return true;end if;
 if op<>'select'then return false;end if;
 family:=learnwise_private.family_student(f,s);
 if t='class_notes'then
  return family and((coalesce((j->>'is_shared_with_student')::boolean,false)and exists(select 1 from public.students where id=s and user_id=auth.uid()))or(coalesce((j->>'is_shared_with_parent')::boolean,false)and exists(select 1 from public.students st join public.parents p on p.id=st.parent_id where st.id=s and p.user_id=auth.uid())));
 end if;
 return family;
end$$;

-- Restrictive policies AND with every permissive policy in the live export,
-- closing broad legacy staff/public-material access without a blanket DROP.
do $$declare t text;op text;using_sql text;check_sql text;begin
 foreach t in array array['profiles','students','parents','tutors','student_tutors','classes','class_notes','homework','materials','invoices','payments','assessment_requests','audit_logs']loop
  foreach op in array array['select','insert','update','delete']loop
   using_sql:=case when op='insert'then ''else format(' using(learnwise_private.row_access(%L,to_jsonb(%I),%L))',t,t,op)end;
   check_sql:=case when op in('insert','update')then format(' with check(learnwise_private.row_access(%L,to_jsonb(%I),%L))',t,t,op)else ''end;
   execute format('create policy %I on public.%I as restrictive for %s to authenticated%s%s','firm_guard_'||op,t,op,using_sql,check_sql);
   execute format('create policy %I on public.%I as permissive for %s to authenticated%s%s','firm_allow_'||op,t,op,using_sql,check_sql);
  end loop;
  execute format('alter table public.%I enable row level security',t);
 end loop;
end$$;
-- Public enquiries remain insert-only; anonymous reads of even public materials
-- are disallowed. Grants/column grants are explicitly cleared.
do $$declare t text;cols text;begin
 foreach t in array array['profiles','students','parents','tutors','student_tutors','classes','class_notes','homework','materials','invoices','payments','audit_logs']loop
  execute format('revoke all on public.%I from public,anon',t);
  select string_agg(quote_ident(attname),',')into cols from pg_attribute where attrelid=('public.'||t)::regclass and attnum>0 and not attisdropped;
  execute format('revoke select(%s),insert(%s),update(%s),references(%s)on public.%I from public,anon',cols,cols,cols,cols,t);
 end loop;
end$$;
revoke all on public.assessment_requests from public,anon;
grant insert(parent_name,parent_email,parent_phone,student_name,student_age,student_grade,school,curriculum,subjects,goals,preferred_mode,message)on public.assessment_requests to anon;
create policy enquiry_guard on public.assessment_requests as restrictive for insert to anon with check(firm_id is null and status='New'and admin_notes is null);

create or replace function learnwise_private.validate_firm_row()returns trigger language plpgsql set search_path='' as $$
declare j jsonb:=to_jsonb(new);f uuid:=(j->>'firm_id')::uuid;k text;target text;target_f uuid;sid uuid;tid uuid;cid uuid;
begin
 if current_user in('authenticated','anon')then
  if tg_op='INSERT'and j?'created_by'then new:=jsonb_populate_record(new,jsonb_build_object('created_by',auth.uid()));end if;
  if tg_op='UPDATE'and j->'created_by'is distinct from to_jsonb(old)->'created_by'then raise exception 'Creator identity is immutable'using errcode='42501';end if;
  if j?'user_id'and((tg_op='INSERT'and(j->>'user_id')is not null)or(tg_op='UPDATE'and j->'user_id'is distinct from to_jsonb(old)->'user_id'))then raise exception 'Use a verified invitation to link accounts'using errcode='42501';end if;
  if tg_op='UPDATE'and j->'firm_id'is distinct from to_jsonb(old)->'firm_id'and not learnwise_private.super()then raise exception 'Firm ownership cannot be changed'using errcode='42501';end if;
 end if;
 foreach k in array array['parent_id','student_id','tutor_id','class_id','invoice_id']loop
  if nullif(j->>k,'')is not null then
   target:=case k when 'parent_id'then 'parents'when 'student_id'then 'students'when 'tutor_id'then 'tutors'when 'class_id'then 'classes'else 'invoices'end;
   execute format('select firm_id from public.%I where id=$1',target)into target_f using(j->>k)::uuid;
   if target_f is distinct from f then raise exception 'Related records must belong to the same firm'using errcode='23514';end if;
  end if;
 end loop;
 cid:=(j->>'class_id')::uuid;sid:=(j->>'student_id')::uuid;tid:=(j->>'tutor_id')::uuid;
 if cid is not null and exists(select 1 from public.classes where id=cid and(student_id is distinct from sid or tutor_id is distinct from tid))then raise exception 'Class assignment mismatch'using errcode='23514';end if;
 if tg_table_name='classes'and tg_op='UPDATE'and not learnwise_private.super()and not learnwise_private.can(f,'manage_academic')and(to_jsonb(new)-array['attendance','status','updated_at'])is distinct from(to_jsonb(old)-array['attendance','status','updated_at'])then raise exception 'Tutors may update attendance and status only'using errcode='42501';end if;
 return new;
end$$;
create or replace function learnwise_private.audit_firm_row()returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb:=case when tg_op='DELETE'then to_jsonb(old)else to_jsonb(new)end;
begin
 insert into public.firm_audit_events(firm_id,actor_user_id,action,table_name,record_id,reason,old_data,new_data)values((j->>'firm_id')::uuid,auth.uid(),lower(tg_op),tg_table_name,(j->>'id')::uuid,nullif(current_setting('learnwise.reason',true),''),case when tg_op<>'INSERT'then to_jsonb(old)end,case when tg_op<>'DELETE'then to_jsonb(new)end);
 return case when tg_op='DELETE'then old else new end;
end$$;
do $$declare t text;begin
 foreach t in array array['students','parents','tutors','student_tutors','classes','class_notes','homework','materials','invoices','payments','assessment_requests']loop
  execute format('create trigger validate_firm_row before insert or update on public.%I for each row execute function learnwise_private.validate_firm_row()',t);
  execute format('create trigger audit_firm_row after insert or update or delete on public.%I for each row execute function learnwise_private.audit_firm_row()',t);
 end loop;
end$$;

create or replace function public.handle_new_user()returns trigger language plpgsql security definer set search_path='' as $$
declare r text:=case when new.raw_user_meta_data->>'role'='parent'then 'parent'else 'student'end;n text:=coalesce(new.raw_user_meta_data->>'full_name',new.email,'New account');begin
 insert into public.profiles(id,full_name,email,role)values(new.id,n,coalesce(new.email,''),r)on conflict(id)do nothing;
 if r='parent'then insert into public.parents(user_id,full_name,email,status)values(new.id,n,new.email,'Active');else insert into public.students(user_id,full_name,email,status)values(new.id,n,new.email,'Active');end if;return new;
end$$;
revoke all on function public.handle_new_user()from public,anon,authenticated;

-- All client management operations below run with caller privileges. Their
-- private implementations perform live persisted authorization before writing.
create or replace function learnwise_private.firm_create(n text)returns uuid language plpgsql security definer set search_path='' as $$declare f uuid;begin
 if not learnwise_private.super()then raise exception 'Super Admin required'using errcode='42501';end if;
 insert into public.firms(name)values(trim(n))returning id into f;
 insert into public.firm_audit_events(firm_id,actor_user_id,action,table_name,record_id,new_data)values(f,auth.uid(),'firm_created','firms',f,jsonb_build_object('name',trim(n)));return f;end$$;
create function public.firm_create(p_name text)returns uuid language sql security invoker set search_path='' as $$select learnwise_private.firm_create(p_name)$$;

create or replace function learnwise_private.firm_grant(f uuid,u uuid,r text,caps text[],why text)returns void language plpgsql security definer set search_path='' as $$declare prior jsonb;begin
 if not learnwise_private.super()then raise exception 'Super Admin required'using errcode='42501';end if;
 if length(trim(coalesce(why,'')))<3 or r not in('admin','tutor')or caps is null or exists(select 1 from unnest(caps)c where c not in('view_roster','manage_roster','manage_tutors','manage_academic','view_billing','issue_invoices','record_payments','void_invoices','correct_payments'))then raise exception 'Valid role, permissions and reason required';end if;
 select to_jsonb(m)into prior from public.firm_memberships m where firm_id=f and user_id=u for update;
 insert into public.firm_memberships(firm_id,user_id,role,permissions)values(f,u,r,caps)on conflict(firm_id,user_id)do update set role=excluded.role,permissions=excluded.permissions,active=true;
 if r='tutor'and not exists(select 1 from public.tutors where firm_id=f and user_id=u)then insert into public.tutors(firm_id,user_id,full_name,email)select f,id,full_name,email from public.profiles where id=u;end if;
 insert into public.firm_audit_events(firm_id,actor_user_id,action,table_name,record_id,reason,old_data,new_data)values(f,auth.uid(),'access_granted','firm_memberships',u,why,prior,jsonb_build_object('role',r,'permissions',caps));end$$;
create function public.firm_grant(p_firm_id uuid,p_user_id uuid,p_role text,p_permissions text[],p_reason text)returns void language sql security invoker set search_path='' as $$select learnwise_private.firm_grant(p_firm_id,p_user_id,p_role,p_permissions,p_reason)$$;
create or replace function learnwise_private.firm_revoke(f uuid,u uuid,why text)returns void language plpgsql security definer set search_path='' as $$declare prior jsonb;begin
 if not learnwise_private.super()then raise exception 'Super Admin required'using errcode='42501';end if;if length(trim(coalesce(why,'')))<3 then raise exception 'Reason required';end if;
 select to_jsonb(m)into prior from public.firm_memberships m where firm_id=f and user_id=u for update;update public.firm_memberships set active=false where firm_id=f and user_id=u;
 insert into public.firm_audit_events(firm_id,actor_user_id,action,table_name,record_id,reason,old_data)values(f,auth.uid(),'access_revoked','firm_memberships',u,why,prior);end$$;
create function public.firm_revoke(p_firm_id uuid,p_user_id uuid,p_reason text)returns void language sql security invoker set search_path='' as $$select learnwise_private.firm_revoke(p_firm_id,p_user_id,p_reason)$$;

create or replace function learnwise_private.roster_add(f uuid,kind text,n text,email text,p uuid,t uuid)returns uuid language plpgsql security definer set search_path='' as $$declare result uuid;own_t uuid;begin
 if not(learnwise_private.can(f,'manage_roster')or learnwise_private.tutor_in(f))then raise exception 'Roster permission required'using errcode='42501';end if;
 if kind not in('student','parent')or length(trim(coalesce(n,'')))not between 1 and 160 then raise exception 'Student/parent name required';end if;
 if learnwise_private.tutor_in(f)then select id into own_t from public.tutors where firm_id=f and user_id=auth.uid()and status='Active';if own_t is null then raise exception 'Active tutor record required';end if;if t is not null and t<>own_t and not learnwise_private.can(f,'manage_roster')then raise exception 'Cannot assign another tutor'using errcode='42501';end if;t:=coalesce(t,own_t);end if;
 if p is not null and not exists(select 1 from public.parents where id=p and firm_id=f and learnwise_private.row_access('parents',to_jsonb(parents),'select'))then raise exception 'Parent not accessible in this firm'using errcode='42501';end if;
 if t is not null and not exists(select 1 from public.tutors where id=t and firm_id=f and status='Active')then raise exception 'Tutor not in firm';end if;
 if kind='parent'then insert into public.parents(firm_id,full_name,email,created_by)values(f,trim(n),nullif(trim(email),''),auth.uid())returning id into result;
 else insert into public.students(firm_id,full_name,email,parent_id,created_by)values(f,trim(n),nullif(trim(email),''),p,auth.uid())returning id into result;
 if t is not null then insert into public.student_tutors(firm_id,student_id,tutor_id)values(f,result,t);end if;end if;return result;end$$;
create function public.roster_add(p_firm_id uuid,p_kind text,p_name text,p_email text default null,p_parent_id uuid default null,p_tutor_id uuid default null)returns uuid language sql security invoker set search_path='' as $$select learnwise_private.roster_add(p_firm_id,p_kind,p_name,p_email,p_parent_id,p_tutor_id)$$;

create or replace function learnwise_private.invite_create(f uuid,kind text,r uuid,email text)returns text language plpgsql security definer set search_path='' as $$declare j jsonb;token text:=gen_random_uuid()::text||gen_random_uuid()::text;begin
 if kind not in('student','parent')then raise exception 'Only student/parent invitations supported';end if;
 execute format('select to_jsonb(x)from public.%I x where id=$1',case kind when 'student'then 'students'else 'parents'end)into j using r;
 if j is null or(j->>'firm_id')::uuid is distinct from f or not learnwise_private.row_access(case kind when 'student'then 'students'else 'parents'end,j,'select')or not(learnwise_private.can(f,'manage_roster')or learnwise_private.tutor_in(f))then raise exception 'Invitation not authorized'using errcode='42501';end if;
 if j->>'user_id'is not null or length(trim(coalesce(email,'')))<3 then raise exception 'Unlinked record and email required';end if;
 insert into public.firm_invitations(firm_id,kind,record_id,email,token_hash,expires_at,created_by)values(f,kind,r,lower(trim(email)),encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '7 days',auth.uid());
 insert into public.firm_audit_events(firm_id,actor_user_id,action,table_name,record_id,new_data)values(f,auth.uid(),'invitation_created','firm_invitations',r,jsonb_build_object('kind',kind));return token;end$$;
create function public.invite_create(p_firm_id uuid,p_kind text,p_record_id uuid,p_email text)returns text language sql security invoker set search_path='' as $$select learnwise_private.invite_create(p_firm_id,p_kind,p_record_id,p_email)$$;
create or replace function learnwise_private.invite_accept(token text)returns uuid language plpgsql security definer set search_path='' as $$declare inv public.firm_invitations;em text;kind text;claimed uuid;begin
 if learnwise_private.active_profile_role()is null then raise exception 'Sign in required'using errcode='42501';end if;
 select email into em from auth.users where id=auth.uid()and email_confirmed_at is not null;
 select * into inv from public.firm_invitations where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex')for update;
 if inv.id is null or inv.accepted_at is not null or inv.expires_at<now()or lower(em)is distinct from inv.email or not exists(select 1 from public.firms where id=inv.firm_id and active)then raise exception 'Invitation invalid, expired or email unconfirmed'using errcode='42501';end if;
 if not exists(select 1 from public.profiles issuer where issuer.id=inv.created_by and issuer.status='Active'and(issuer.role='super_admin'or exists(select 1 from public.firm_memberships m where m.user_id=issuer.id and m.firm_id=inv.firm_id and m.active and('manage_roster'=any(m.permissions)or(m.role='tutor'and exists(select 1 from public.tutors t where t.user_id=issuer.id and t.firm_id=inv.firm_id and t.status='Active'))))))then raise exception 'Invitation issuer no longer authorized'using errcode='42501';end if;
 if learnwise_private.active_profile_role()<>inv.kind then raise exception 'Sign up with the matching parent/student role';end if;
 kind:=case inv.kind when 'student'then 'students'else 'parents'end;
 execute format('update public.%I set user_id=$1 where id=$2 and firm_id=$3 and user_id is null returning id',kind)into claimed using auth.uid(),inv.record_id,inv.firm_id;
 if claimed is null then raise exception 'Record already linked';end if;
 update public.firm_invitations set accepted_at=now(),accepted_by=auth.uid()where id=inv.id;
 insert into public.firm_audit_events(firm_id,actor_user_id,action,table_name,record_id)values(inv.firm_id,auth.uid(),'invitation_accepted',kind,claimed);return inv.firm_id;end$$;
create function public.invite_accept(p_token text)returns uuid language sql security invoker set search_path='' as $$select learnwise_private.invite_accept(p_token)$$;

-- Only Super Admin can see audit snapshots. All client access to membership,
-- invitations and adjustments is through checked operations.
do $$declare t text;begin foreach t in array array['firms','firm_memberships','firm_audit_events','firm_invitations','payment_adjustments']loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);end loop;end$$;
grant select on public.firms,public.firm_memberships,public.firm_audit_events to authenticated;
create policy firm_audit_read on public.firm_audit_events for select to authenticated using(learnwise_private.super());
create policy membership_read on public.firm_memberships for select to authenticated using(learnwise_private.super()or(user_id=auth.uid()and active and learnwise_private.active_profile_role()is not null));
create policy firm_read on public.firms for select to authenticated using(learnwise_private.active_profile_role()is not null and(learnwise_private.super()or exists(select 1 from public.firm_memberships m where m.firm_id=firms.id and m.user_id=auth.uid()and m.active)or exists(select 1 from public.parents p where p.firm_id=firms.id and p.user_id=auth.uid())or exists(select 1 from public.students s where s.firm_id=firms.id and learnwise_private.family_student(firms.id,s.id))));
-- Every private function performs its own authorization; trigger functions are
-- not public RPCs. Tight ACLs are installed in the same transaction.
revoke all on all functions in schema learnwise_private from public,anon;
grant execute on all functions in schema learnwise_private to authenticated;
revoke all on function learnwise_private.validate_firm_row(),learnwise_private.audit_firm_row()from authenticated;
revoke all on function public.firm_create(text),public.firm_grant(uuid,uuid,text,text[],text),public.firm_revoke(uuid,uuid,text),public.roster_add(uuid,text,text,text,uuid,uuid),public.invite_create(uuid,text,uuid,text),public.invite_accept(text)from public,anon;
grant execute on function public.firm_create(text),public.firm_grant(uuid,uuid,text,text[],text),public.firm_revoke(uuid,uuid,text),public.roster_add(uuid,text,text,text,uuid,uuid),public.invite_create(uuid,text,uuid,text),public.invite_accept(text)to authenticated;
commit;
notify pgrst,'reload schema';
