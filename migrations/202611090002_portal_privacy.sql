-- Existing database policy upgrade. Review the production schema report first.
-- Replaces legacy policies on these application tables; preserves records and roles.
-- Apply AFTER profile hardening and schema reconciliation, BEFORE atomic billing.
begin;
do $$ declare p record; begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename=any(array['profiles','tutors','parents','students','student_tutors','classes','class_notes','homework','invoices','payments','materials','assessment_requests','audit_logs']) loop
 execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
-- Definer helpers avoid policy recursion. Roles come only from persisted profiles.
create or replace function public.current_active_role() returns text
language sql stable security definer set search_path = '' as $$
 select role from public.profiles where id = auth.uid() and status = 'Active'
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce(public.current_active_role() = 'admin', false)
$$;
create or replace function public.owns_tutor(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.current_active_role() = 'tutor' and exists (
 select 1 from public.tutors where id = tid and user_id = auth.uid() and status = 'Active')
$$;
create or replace function public.owns_parent(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.current_active_role() = 'parent' and exists (
 select 1 from public.parents where id = pid and user_id = auth.uid() and status = 'Active')
$$;
create or replace function public.owns_student(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.current_active_role() = 'student' and exists (
 select 1 from public.students where id = sid and user_id = auth.uid() and status = 'Active')
$$;
create or replace function public.parent_of(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.students s where s.id = sid and public.owns_parent(s.parent_id))
$$;
create or replace function public.teaches(tid uuid, sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.owns_tutor(tid) and exists (
 select 1 from public.student_tutors st join public.students s on s.id = st.student_id
 where st.tutor_id = tid and st.student_id = sid and st.is_active and s.status = 'Active')
$$;
create or replace function public.student_visible(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.owns_student(sid) or public.parent_of(sid) or exists (
 select 1 from public.student_tutors st where st.student_id = sid and public.teaches(st.tutor_id, sid))
$$;
create or replace function public.tutor_visible(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.owns_tutor(tid) or exists (
 select 1 from public.student_tutors st where st.tutor_id = tid and st.is_active
 and (public.owns_student(st.student_id) or public.parent_of(st.student_id)))
$$;
create or replace function public.parent_visible(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.owns_parent(pid) or exists (
 select 1 from public.students s where s.parent_id = pid and public.student_visible(s.id))
$$;
create or replace function public.valid_academic_link(tid uuid, sid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.teaches(tid, sid) and (cid is null or exists (
 select 1 from public.classes c where c.id = cid and c.tutor_id = tid and c.student_id = sid))
$$;
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles (id, full_name, email, role) values (
 new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email, 'New account'), coalesce(new.email, ''),
 case when new.raw_user_meta_data->>'role' in ('tutor','parent','student')
 then new.raw_user_meta_data->>'role' else 'student' end) on conflict (id) do nothing;
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
alter table public.tutors enable row level security;
revoke all on public.tutors from public, anon, authenticated;
grant select on public.tutors to authenticated;
grant insert, update, delete on public.tutors to authenticated;
drop trigger if exists updated_at on public.tutors;
create trigger updated_at before update on public.tutors for each row execute function public.set_updated_at();
alter table public.parents enable row level security;
revoke all on public.parents from public, anon, authenticated;
grant select on public.parents to authenticated;
grant insert, update, delete on public.parents to authenticated;
drop trigger if exists updated_at on public.parents;
create trigger updated_at before update on public.parents for each row execute function public.set_updated_at();
alter table public.students enable row level security;
revoke all on public.students from public, anon, authenticated;
grant select on public.students to authenticated;
grant insert, update, delete on public.students to authenticated;
drop trigger if exists updated_at on public.students;
create trigger updated_at before update on public.students for each row execute function public.set_updated_at();
alter table public.student_tutors enable row level security;
revoke all on public.student_tutors from public, anon, authenticated;
grant select on public.student_tutors to authenticated;
grant insert, update, delete on public.student_tutors to authenticated;
alter table public.classes enable row level security;
revoke all on public.classes from public, anon, authenticated;
grant select on public.classes to authenticated;
grant insert, update, delete on public.classes to authenticated;
drop trigger if exists updated_at on public.classes;
create trigger updated_at before update on public.classes for each row execute function public.set_updated_at();
alter table public.class_notes enable row level security;
revoke all on public.class_notes from public, anon, authenticated;
grant select on public.class_notes to authenticated;
grant insert, update, delete on public.class_notes to authenticated;
drop trigger if exists updated_at on public.class_notes;
create trigger updated_at before update on public.class_notes for each row execute function public.set_updated_at();
alter table public.homework enable row level security;
revoke all on public.homework from public, anon, authenticated;
grant select on public.homework to authenticated;
grant insert, update, delete on public.homework to authenticated;
drop trigger if exists updated_at on public.homework;
create trigger updated_at before update on public.homework for each row execute function public.set_updated_at();
alter table public.invoices enable row level security;
revoke all on public.invoices from public, anon, authenticated;
grant select on public.invoices to authenticated;
grant insert, update, delete on public.invoices to authenticated;
drop trigger if exists updated_at on public.invoices;
create trigger updated_at before update on public.invoices for each row execute function public.set_updated_at();
alter table public.payments enable row level security;
revoke all on public.payments from public, anon, authenticated;
grant select on public.payments to authenticated;
grant insert, update, delete on public.payments to authenticated;
drop trigger if exists updated_at on public.payments;
create trigger updated_at before update on public.payments for each row execute function public.set_updated_at();
alter table public.materials enable row level security;
revoke all on public.materials from public, anon, authenticated;
grant select on public.materials to authenticated;
grant insert, update, delete on public.materials to authenticated;
drop trigger if exists updated_at on public.materials;
create trigger updated_at before update on public.materials for each row execute function public.set_updated_at();
alter table public.assessment_requests enable row level security;
revoke all on public.assessment_requests from public, anon, authenticated;
grant select on public.assessment_requests to authenticated;
grant insert, update, delete on public.assessment_requests to authenticated;
drop trigger if exists updated_at on public.assessment_requests;
create trigger updated_at before update on public.assessment_requests for each row execute function public.set_updated_at();
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from public, anon, authenticated;
grant select on public.audit_logs to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
-- No INSERT or role/status UPDATE grant for profiles, even before hardening.
drop policy if exists admin_all on public.tutors;
create policy admin_all on public.tutors for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.parents;
create policy admin_all on public.parents for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.students;
create policy admin_all on public.students for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.student_tutors;
create policy admin_all on public.student_tutors for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.classes;
create policy admin_all on public.classes for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.class_notes;
create policy admin_all on public.class_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.homework;
create policy admin_all on public.homework for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.invoices;
create policy admin_all on public.invoices for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.payments;
create policy admin_all on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.materials;
create policy admin_all on public.materials for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.assessment_requests;
create policy admin_all on public.assessment_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists profile_read on public.profiles;
create policy profile_read on public.profiles for select to authenticated using ((id = auth.uid() and public.current_active_role() is not null) or public.is_admin());
drop policy if exists profile_edit on public.profiles;
create policy profile_edit on public.profiles for update to authenticated using (id = auth.uid() and public.current_active_role() is not null) with check (id = auth.uid() and public.current_active_role() is not null);
drop policy if exists related_read on public.tutors;
create policy related_read on public.tutors for select to authenticated using (public.tutor_visible(id));
drop policy if exists related_read on public.parents;
create policy related_read on public.parents for select to authenticated using (public.parent_visible(id));
drop policy if exists related_read on public.students;
create policy related_read on public.students for select to authenticated using (public.student_visible(id));
drop policy if exists related_read on public.student_tutors;
create policy related_read on public.student_tutors for select to authenticated using (is_active and (public.owns_tutor(tutor_id) or public.owns_student(student_id) or public.parent_of(student_id)));
drop policy if exists related_read on public.classes;
create policy related_read on public.classes for select to authenticated using (public.student_visible(student_id) and (not (public.current_active_role() = 'tutor') or public.teaches(tutor_id, student_id)));
drop policy if exists tutor_attendance on public.classes;
create policy tutor_attendance on public.classes for update to authenticated using (public.teaches(tutor_id, student_id)) with check (public.teaches(tutor_id, student_id));
drop policy if exists tutor_read on public.class_notes;
create policy tutor_read on public.class_notes for select to authenticated using (public.valid_academic_link(tutor_id, student_id, class_id));
drop policy if exists tutor_insert on public.class_notes;
create policy tutor_insert on public.class_notes for insert to authenticated with check (public.valid_academic_link(tutor_id, student_id, class_id));
drop policy if exists tutor_update on public.class_notes;
create policy tutor_update on public.class_notes for update to authenticated using (public.valid_academic_link(tutor_id, student_id, class_id)) with check (public.valid_academic_link(tutor_id, student_id, class_id));
drop policy if exists tutor_delete on public.class_notes;
create policy tutor_delete on public.class_notes for delete to authenticated using (public.valid_academic_link(tutor_id, student_id, class_id));
drop policy if exists tutor_read on public.homework;
create policy tutor_read on public.homework for select to authenticated using (public.valid_academic_link(tutor_id, student_id, class_id));
drop policy if exists tutor_insert on public.homework;
create policy tutor_insert on public.homework for insert to authenticated with check (public.valid_academic_link(tutor_id, student_id, class_id));
drop policy if exists tutor_update on public.homework;
create policy tutor_update on public.homework for update to authenticated using (public.valid_academic_link(tutor_id, student_id, class_id)) with check (public.valid_academic_link(tutor_id, student_id, class_id));
drop policy if exists tutor_delete on public.homework;
create policy tutor_delete on public.homework for delete to authenticated using (public.valid_academic_link(tutor_id, student_id, class_id));
drop policy if exists tutor_read on public.materials;
create policy tutor_read on public.materials for select to authenticated using (public.owns_tutor(tutor_id) and (student_id is null or public.valid_academic_link(tutor_id, student_id, class_id)));
drop policy if exists tutor_insert on public.materials;
create policy tutor_insert on public.materials for insert to authenticated with check (public.owns_tutor(tutor_id) and (student_id is null or public.valid_academic_link(tutor_id, student_id, class_id)));
drop policy if exists tutor_update on public.materials;
create policy tutor_update on public.materials for update to authenticated using (public.owns_tutor(tutor_id) and (student_id is null or public.valid_academic_link(tutor_id, student_id, class_id))) with check (public.owns_tutor(tutor_id) and (student_id is null or public.valid_academic_link(tutor_id, student_id, class_id)));
drop policy if exists tutor_delete on public.materials;
create policy tutor_delete on public.materials for delete to authenticated using (public.owns_tutor(tutor_id) and (student_id is null or public.valid_academic_link(tutor_id, student_id, class_id)));
drop policy if exists family_read on public.homework;
create policy family_read on public.homework for select to authenticated using (public.owns_student(student_id) or public.parent_of(student_id));
drop policy if exists shared_read on public.class_notes;
create policy shared_read on public.class_notes for select to authenticated using ((is_shared_with_student and public.owns_student(student_id)) or (is_shared_with_parent and public.parent_of(student_id)));
drop policy if exists family_read on public.materials;
create policy family_read on public.materials for select to authenticated using (public.owns_student(student_id) or public.parent_of(student_id) or
 (student_id is null and is_public and exists (select 1 from public.student_tutors st where st.tutor_id = materials.tutor_id and st.is_active and (public.owns_student(st.student_id) or public.parent_of(st.student_id)))));
drop policy if exists parent_read on public.invoices;
create policy parent_read on public.invoices for select to authenticated using (public.owns_parent(parent_id));
drop policy if exists parent_read on public.payments;
create policy parent_read on public.payments for select to authenticated using (public.owns_parent(parent_id));
drop policy if exists admin_read on public.audit_logs;
create policy admin_read on public.audit_logs for select to authenticated using (public.is_admin());
drop policy if exists admin_append on public.audit_logs;
create policy admin_append on public.audit_logs for insert to authenticated with check (public.is_admin() and actor_user_id = auth.uid() and actor_role = public.current_active_role());
grant insert on public.audit_logs to authenticated;
grant insert (parent_name, parent_email, parent_phone, student_name, student_age, student_grade, school, curriculum, subjects, goals, preferred_mode, message) on public.assessment_requests to anon;
drop policy if exists public_assessment on public.assessment_requests;
create policy public_assessment on public.assessment_requests for insert to anon, authenticated with check (
 status = 'New' and admin_notes is null and length(trim(parent_name)) > 0 and length(trim(parent_email)) > 0 and length(trim(student_name)) > 0
);

-- Tutors may mark attendance/status, but cannot reassign or edit billing/schedule fields.
create or replace function public.guard_class_update() returns trigger
language plpgsql set search_path = '' as $$
begin
 if not public.is_admin() and (to_jsonb(new) - array['attendance','status','updated_at']) is distinct from
 (to_jsonb(old) - array['attendance','status','updated_at']) then
 raise exception 'Only attendance and status may be changed' using errcode = '42501';
 end if;
 return new;
end; $$;
drop trigger if exists guard_class_update on public.classes;
create trigger guard_class_update before update on public.classes for each row execute function public.guard_class_update();

-- Do not expose definer trigger functions as callable public RPCs.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.guard_class_update() from public, anon, authenticated;


do $$ begin if exists(select 1 from information_schema.columns where table_schema='public' and table_name='tutors' and column_name<>all(array['id','user_id','full_name','email','phone','subjects','curriculum','rate_qar','bio','notes','status','created_at','updated_at'])) then raise exception 'Unexpected columns on tutors; review disclosure rules before migration'; end if; end $$;

-- The base table exposes only non-sensitive columns. The read-only view applies
-- explicit row authorization and masks private columns before returning data.
revoke select on public.tutors from public,anon,authenticated;
do $$ declare all_columns text; safe_columns text; projection text; begin
 select string_agg(quote_ident(attname),', ') into all_columns from pg_attribute where attrelid='public.tutors'::regclass and attnum>0 and not attisdropped;
 execute 'revoke select ('||all_columns||') on public.tutors from public,anon,authenticated';
 select string_agg(quote_ident(attname),', ') into safe_columns from pg_attribute where attrelid='public.tutors'::regclass and attnum>0 and not attisdropped and attname<>all(array['notes','rate_qar','email','phone','user_id']);
 execute 'grant select ('||safe_columns||') on public.tutors to authenticated';
 select string_agg(case attname when 'notes' then 'case when public.is_admin() then '||quote_ident(attname)||' else null end as '||quote_ident(attname) when 'rate_qar' then 'case when public.is_admin() or public.owns_tutor(id) then '||quote_ident(attname)||' else null end as '||quote_ident(attname) when 'email' then 'case when public.is_admin() or public.owns_tutor(id) then '||quote_ident(attname)||' else null end as '||quote_ident(attname) when 'phone' then 'case when public.is_admin() or public.owns_tutor(id) then '||quote_ident(attname)||' else null end as '||quote_ident(attname) when 'user_id' then 'case when public.is_admin() or public.owns_tutor(id) then '||quote_ident(attname)||' else null end as '||quote_ident(attname) else quote_ident(attname) end,', ' order by attnum) into projection from pg_attribute where attrelid='public.tutors'::regclass and attnum>0 and not attisdropped;
 execute 'create or replace view public.portal_tutors with (security_barrier=true) as select '||projection||' from public.tutors where public.is_admin() or public.tutor_visible(id)';
end $$;
revoke all on public.portal_tutors from public,anon,authenticated;
grant select on public.portal_tutors to authenticated;

do $$ declare columns_sql text; begin
 select string_agg(quote_ident(attname),', ') into columns_sql from pg_attribute where attrelid='public.portal_tutors'::regclass and attnum>0 and not attisdropped;
 execute 'revoke insert ('||columns_sql||'),update ('||columns_sql||'),references ('||columns_sql||') on public.portal_tutors from public,anon,authenticated';
end $$;

do $$ begin if exists(select 1 from information_schema.columns where table_schema='public' and table_name='parents' and column_name<>all(array['id','user_id','full_name','email','phone','address','notes','status','created_at','updated_at'])) then raise exception 'Unexpected columns on parents; review disclosure rules before migration'; end if; end $$;

-- The base table exposes only non-sensitive columns. The read-only view applies
-- explicit row authorization and masks private columns before returning data.
revoke select on public.parents from public,anon,authenticated;
do $$ declare all_columns text; safe_columns text; projection text; begin
 select string_agg(quote_ident(attname),', ') into all_columns from pg_attribute where attrelid='public.parents'::regclass and attnum>0 and not attisdropped;
 execute 'revoke select ('||all_columns||') on public.parents from public,anon,authenticated';
 select string_agg(quote_ident(attname),', ') into safe_columns from pg_attribute where attrelid='public.parents'::regclass and attnum>0 and not attisdropped and attname<>all(array['notes','address','email','phone','user_id']);
 execute 'grant select ('||safe_columns||') on public.parents to authenticated';
 select string_agg(case attname when 'notes' then 'case when public.is_admin() then '||quote_ident(attname)||' else null end as '||quote_ident(attname) when 'address' then 'case when public.is_admin() or public.owns_parent(id) then '||quote_ident(attname)||' else null end as '||quote_ident(attname) when 'email' then 'case when public.is_admin() or public.owns_parent(id) then '||quote_ident(attname)||' else null end as '||quote_ident(attname) when 'phone' then 'case when public.is_admin() or public.owns_parent(id) then '||quote_ident(attname)||' else null end as '||quote_ident(attname) when 'user_id' then 'case when public.is_admin() or public.owns_parent(id) then '||quote_ident(attname)||' else null end as '||quote_ident(attname) else quote_ident(attname) end,', ' order by attnum) into projection from pg_attribute where attrelid='public.parents'::regclass and attnum>0 and not attisdropped;
 execute 'create or replace view public.portal_parents with (security_barrier=true) as select '||projection||' from public.parents where public.is_admin() or public.parent_visible(id)';
end $$;
revoke all on public.portal_parents from public,anon,authenticated;
grant select on public.portal_parents to authenticated;

do $$ declare columns_sql text; begin
 select string_agg(quote_ident(attname),', ') into columns_sql from pg_attribute where attrelid='public.portal_parents'::regclass and attnum>0 and not attisdropped;
 execute 'revoke insert ('||columns_sql||'),update ('||columns_sql||'),references ('||columns_sql||') on public.portal_parents from public,anon,authenticated';
end $$;

do $$ begin if exists(select 1 from information_schema.columns where table_schema='public' and table_name='students' and column_name<>all(array['id','user_id','parent_id','full_name','email','phone','date_of_birth','age','grade','school','curriculum','subjects','goals','strengths','weak_areas','notes','status','created_at','updated_at'])) then raise exception 'Unexpected columns on students; review disclosure rules before migration'; end if; end $$;

-- The base table exposes only non-sensitive columns. The read-only view applies
-- explicit row authorization and masks private columns before returning data.
revoke select on public.students from public,anon,authenticated;
do $$ declare all_columns text; safe_columns text; projection text; begin
 select string_agg(quote_ident(attname),', ') into all_columns from pg_attribute where attrelid='public.students'::regclass and attnum>0 and not attisdropped;
 execute 'revoke select ('||all_columns||') on public.students from public,anon,authenticated';
 select string_agg(quote_ident(attname),', ') into safe_columns from pg_attribute where attrelid='public.students'::regclass and attnum>0 and not attisdropped and attname<>all(array['notes','email','phone','date_of_birth','user_id']);
 execute 'grant select ('||safe_columns||') on public.students to authenticated';
 select string_agg(case attname when 'notes' then 'case when public.is_admin() then '||quote_ident(attname)||' else null end as '||quote_ident(attname) when 'email' then 'case when public.is_admin() or public.owns_student(id) or public.parent_of(id) then '||quote_ident(attname)||' else null end as '||quote_ident(attname) when 'phone' then 'case when public.is_admin() or public.owns_student(id) or public.parent_of(id) then '||quote_ident(attname)||' else null end as '||quote_ident(attname) when 'date_of_birth' then 'case when public.is_admin() or public.owns_student(id) or public.parent_of(id) then '||quote_ident(attname)||' else null end as '||quote_ident(attname) when 'user_id' then 'case when public.is_admin() or public.owns_student(id) or public.parent_of(id) then '||quote_ident(attname)||' else null end as '||quote_ident(attname) else quote_ident(attname) end,', ' order by attnum) into projection from pg_attribute where attrelid='public.students'::regclass and attnum>0 and not attisdropped;
 execute 'create or replace view public.portal_students with (security_barrier=true) as select '||projection||' from public.students where public.is_admin() or public.student_visible(id)';
end $$;
revoke all on public.portal_students from public,anon,authenticated;
grant select on public.portal_students to authenticated;

do $$ declare columns_sql text; begin
 select string_agg(quote_ident(attname),', ') into columns_sql from pg_attribute where attrelid='public.portal_students'::regclass and attnum>0 and not attisdropped;
 execute 'revoke insert ('||columns_sql||'),update ('||columns_sql||'),references ('||columns_sql||') on public.portal_students from public,anon,authenticated';
end $$;

do $$ begin if exists(select 1 from information_schema.columns where table_schema='public' and table_name='classes' and column_name<>all(array['id','student_id','tutor_id','subject','topic','scheduled_at','duration_min','mode','meeting_link','location','status','attendance','payment_status','rate_qar','notes','created_at','updated_at'])) then raise exception 'Unexpected columns on classes; review disclosure rules before migration'; end if; end $$;

-- The base table exposes only non-sensitive columns. The read-only view applies
-- explicit row authorization and masks private columns before returning data.
revoke select on public.classes from public,anon,authenticated;
do $$ declare all_columns text; safe_columns text; projection text; begin
 select string_agg(quote_ident(attname),', ') into all_columns from pg_attribute where attrelid='public.classes'::regclass and attnum>0 and not attisdropped;
 execute 'revoke select ('||all_columns||') on public.classes from public,anon,authenticated';
 select string_agg(quote_ident(attname),', ') into safe_columns from pg_attribute where attrelid='public.classes'::regclass and attnum>0 and not attisdropped and attname<>all(array['notes','rate_qar','payment_status']);
 execute 'grant select ('||safe_columns||') on public.classes to authenticated';
 select string_agg(case attname when 'notes' then 'case when public.is_admin() then '||quote_ident(attname)||' else null end as '||quote_ident(attname) when 'rate_qar' then 'case when public.is_admin() then '||quote_ident(attname)||' else null end as '||quote_ident(attname) when 'payment_status' then 'case when public.is_admin() then '||quote_ident(attname)||' else null end as '||quote_ident(attname) else quote_ident(attname) end,', ' order by attnum) into projection from pg_attribute where attrelid='public.classes'::regclass and attnum>0 and not attisdropped;
 execute 'create or replace view public.portal_classes with (security_barrier=true) as select '||projection||' from public.classes where public.is_admin() or (public.student_visible(student_id) and (public.current_active_role()<>''tutor'' or public.teaches(tutor_id,student_id)))';
end $$;
revoke all on public.portal_classes from public,anon,authenticated;
grant select on public.portal_classes to authenticated;

do $$ declare columns_sql text; begin
 select string_agg(quote_ident(attname),', ') into columns_sql from pg_attribute where attrelid='public.portal_classes'::regclass and attnum>0 and not attisdropped;
 execute 'revoke insert ('||columns_sql||'),update ('||columns_sql||'),references ('||columns_sql||') on public.portal_classes from public,anon,authenticated';
end $$;

do $$ begin if exists(select 1 from information_schema.columns where table_schema='public' and table_name='invoices' and column_name<>all(array['id','parent_id','student_id','invoice_number','period_start','period_end','subtotal_qar','discount_qar','total_qar','paid_qar','balance_qar','currency','status','issued_at','due_at','notes','created_at','updated_at'])) then raise exception 'Unexpected columns on invoices; review disclosure rules before migration'; end if; end $$;

-- The base table exposes only non-sensitive columns. The read-only view applies
-- explicit row authorization and masks private columns before returning data.
revoke select on public.invoices from public,anon,authenticated;
do $$ declare all_columns text; safe_columns text; projection text; begin
 select string_agg(quote_ident(attname),', ') into all_columns from pg_attribute where attrelid='public.invoices'::regclass and attnum>0 and not attisdropped;
 execute 'revoke select ('||all_columns||') on public.invoices from public,anon,authenticated';
 select string_agg(quote_ident(attname),', ') into safe_columns from pg_attribute where attrelid='public.invoices'::regclass and attnum>0 and not attisdropped and attname<>all(array['notes']);
 execute 'grant select ('||safe_columns||') on public.invoices to authenticated';
 select string_agg(case attname when 'notes' then 'case when public.is_admin() then '||quote_ident(attname)||' else null end as '||quote_ident(attname) else quote_ident(attname) end,', ' order by attnum) into projection from pg_attribute where attrelid='public.invoices'::regclass and attnum>0 and not attisdropped;
 execute 'create or replace view public.portal_invoices with (security_barrier=true) as select '||projection||' from public.invoices where public.is_admin() or public.owns_parent(parent_id)';
end $$;
revoke all on public.portal_invoices from public,anon,authenticated;
grant select on public.portal_invoices to authenticated;

do $$ declare columns_sql text; begin
 select string_agg(quote_ident(attname),', ') into columns_sql from pg_attribute where attrelid='public.portal_invoices'::regclass and attnum>0 and not attisdropped;
 execute 'revoke insert ('||columns_sql||'),update ('||columns_sql||'),references ('||columns_sql||') on public.portal_invoices from public,anon,authenticated';
end $$;

do $$ begin if exists(select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name<>all(array['id','invoice_id','parent_id','student_id','tutor_id','amount_qar','method','reference','paid_at','notes','created_at','updated_at'])) then raise exception 'Unexpected columns on payments; review disclosure rules before migration'; end if; end $$;

-- The base table exposes only non-sensitive columns. The read-only view applies
-- explicit row authorization and masks private columns before returning data.
revoke select on public.payments from public,anon,authenticated;
do $$ declare all_columns text; safe_columns text; projection text; begin
 select string_agg(quote_ident(attname),', ') into all_columns from pg_attribute where attrelid='public.payments'::regclass and attnum>0 and not attisdropped;
 execute 'revoke select ('||all_columns||') on public.payments from public,anon,authenticated';
 select string_agg(quote_ident(attname),', ') into safe_columns from pg_attribute where attrelid='public.payments'::regclass and attnum>0 and not attisdropped and attname<>all(array['notes']);
 execute 'grant select ('||safe_columns||') on public.payments to authenticated';
 select string_agg(case attname when 'notes' then 'case when public.is_admin() then '||quote_ident(attname)||' else null end as '||quote_ident(attname) else quote_ident(attname) end,', ' order by attnum) into projection from pg_attribute where attrelid='public.payments'::regclass and attnum>0 and not attisdropped;
 execute 'create or replace view public.portal_payments with (security_barrier=true) as select '||projection||' from public.payments where public.is_admin() or public.owns_parent(parent_id)';
end $$;
revoke all on public.portal_payments from public,anon,authenticated;
grant select on public.portal_payments to authenticated;

do $$ declare columns_sql text; begin
 select string_agg(quote_ident(attname),', ') into columns_sql from pg_attribute where attrelid='public.portal_payments'::regclass and attnum>0 and not attisdropped;
 execute 'revoke insert ('||columns_sql||'),update ('||columns_sql||'),references ('||columns_sql||') on public.portal_payments from public,anon,authenticated';
end $$;

commit;
notify pgrst,'reload schema';
