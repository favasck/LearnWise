const fs=require('fs');let p='tests/app-render.test.js',s=fs.readFileSync(p,'utf8').replace("role: 'tutor' }, authError", "role: 'admin' }, authError");fs.writeFileSync(p,s);
const old=fs.readFileSync('supabase_setup.sql','utf8');
const tables=[...old.matchAll(/create table if not exists public\.(\w+) \([\s\S]*?\n\);/g)];
let sql=`-- Run this file FIRST, before 202611030001_protect_profile_updates.sql.\n-- Explicit order overrides filename order. Empty Supabase database bootstrap.\n-- Replaying this file preserves the profile column restrictions of the second file.\nbegin;\n\n`;
for(const t of tables) sql+=t[0]+'\n\n';
sql+=`create table if not exists public.audit_logs (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references public.profiles(id), actor_name text, actor_role text,
 action text not null, table_name text, record_id uuid,
 old_data jsonb, new_data jsonb, reason text, module text,
 severity text not null default 'info' check (severity in ('info','warning','critical')),
 created_at timestamptz not null default now()
);

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

`;
const names=tables.map(t=>t[1]);
for(const name of [...names,'audit_logs']) {
 sql+=`alter table public.${name} enable row level security;\nrevoke all on public.${name} from public, anon, authenticated;\n`;
 sql+=`grant select on public.${name} to authenticated;\n`;
 if(!['profiles','audit_logs'].includes(name)) sql+=`grant insert, update, delete on public.${name} to authenticated;\n`;
 if(!['profiles','audit_logs','student_tutors'].includes(name)) sql+=`drop trigger if exists updated_at on public.${name};\ncreate trigger updated_at before update on public.${name} for each row execute function public.set_updated_at();\n`;
}
sql+=`grant update (full_name, phone) on public.profiles to authenticated;
-- No INSERT or role/status UPDATE grant for profiles, even before hardening.
`;
function policy(table,name,command,using,check){sql+=`drop policy if exists ${name} on public.${table};\ncreate policy ${name} on public.${table} for ${command} to authenticated`+(using?` using (${using})`:'')+(check?` with check (${check})`:'')+';\n';}
for(const name of names.filter(n=>n!=='profiles'))policy(name,'admin_all','all','public.is_admin()','public.is_admin()');
policy('profiles','profile_read','select','(id = auth.uid() and public.current_active_role() is not null) or public.is_admin()');
policy('profiles','profile_edit','update','id = auth.uid() and public.current_active_role() is not null','id = auth.uid() and public.current_active_role() is not null');
policy('tutors','related_read','select','public.tutor_visible(id)');
policy('parents','related_read','select','public.parent_visible(id)');
policy('students','related_read','select','public.student_visible(id)');
policy('student_tutors','related_read','select','is_active and (public.owns_tutor(tutor_id) or public.owns_student(student_id) or public.parent_of(student_id))');
policy('classes','related_read','select','public.student_visible(student_id) and (not (public.current_active_role() = \'tutor\') or public.teaches(tutor_id, student_id))');
policy('classes','tutor_attendance','update','public.teaches(tutor_id, student_id)','public.teaches(tutor_id, student_id)');
for(const name of ['class_notes','homework','materials']){
 const scope=`public.valid_academic_link(tutor_id, student_id, class_id)`;
 // Tutor-wide materials are permitted only for the tutor's current assigned students on reads.
 const write=name==='materials'?`public.owns_tutor(tutor_id) and (student_id is null or ${scope})`:scope;
 policy(name,'tutor_read','select',write);
 policy(name,'tutor_insert','insert',null,write);
 policy(name,'tutor_update','update',write,write);
 policy(name,'tutor_delete','delete',write);
}
policy('homework','family_read','select','public.owns_student(student_id) or public.parent_of(student_id)');
policy('class_notes','shared_read','select','(is_shared_with_student and public.owns_student(student_id)) or (is_shared_with_parent and public.parent_of(student_id))');
policy('materials','family_read','select',`public.owns_student(student_id) or public.parent_of(student_id) or
 (student_id is null and is_public and exists (select 1 from public.student_tutors st where st.tutor_id = materials.tutor_id and st.is_active and (public.owns_student(st.student_id) or public.parent_of(st.student_id))))`);
for(const name of ['invoices','payments'])policy(name,'parent_read','select','public.owns_parent(parent_id)');
policy('audit_logs','admin_read','select','public.is_admin()');
policy('audit_logs','admin_append','insert',null,'public.is_admin() and actor_id = auth.uid() and actor_role = public.current_active_role()');
sql+=`grant insert on public.audit_logs to authenticated;
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
commit;
`;
fs.writeFileSync('migrations/202611070001_bootstrap_schema.sql',sql);
