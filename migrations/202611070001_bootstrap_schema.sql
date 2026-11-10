-- Run this file FIRST, before 202611030001_protect_profile_updates.sql.
-- Explicit order overrides filename order. Empty Supabase database bootstrap.
-- Replaying this file preserves the profile column restrictions of the second file.
begin;
grant usage on schema public to anon, authenticated;

create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  full_name   text        not null,
  email       text        not null,
  role        text        not null default 'student'
                          check (role in ('super_admin','admin_tutor','tutor','parent','student')),
  phone       text,
  status      text        not null default 'Active'
                          check (status in ('Active','Suspended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.tutors (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete set null,
  -- user_id is null until an admin links their auth account
  full_name    text        not null,
  email        text,
  phone        text,
  subjects     text[]      not null default '{}',
  -- e.g. ARRAY['Mathematics','Physics']
  curriculum   text[]      not null default '{}',
  -- e.g. ARRAY['IGCSE','Edexcel']
  rate_qar     numeric(10,2) not null default 0,
  -- hourly rate in QAR
  bio          text,
  notes        text,
  -- internal admin notes
  status       text        not null default 'Active'
                           check (status in ('Active','Inactive','On Leave')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.parents (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete set null,
  full_name    text        not null,
  email        text,
  phone        text,
  address      text,
  notes        text,
  status       text        not null default 'Active'
                           check (status in ('Active','Inactive')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.students (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete set null,
  parent_id    uuid        references public.parents(id) on delete set null,
  full_name    text        not null,
  email        text,
  phone        text,
  date_of_birth date,
  age          int,
  grade        text,
  -- e.g. 'Year 10'
  school       text,
  curriculum   text,
  -- e.g. 'IGCSE'
  subjects     text[]      not null default '{}',
  goals        text,
  strengths    text,
  weak_areas   text,
  notes        text,
  status       text        not null default 'Active'
                           check (status in ('Active','Inactive','Graduated')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.student_tutors (
  id          uuid        primary key default gen_random_uuid(),
  student_id  uuid        not null references public.students(id) on delete cascade,
  tutor_id    uuid        not null references public.tutors(id)   on delete cascade,
  subjects    text[]      not null default '{}',
  -- subjects this tutor teaches THIS student (subset of student.subjects)
  is_active   boolean     not null default true,
  assigned_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (student_id, tutor_id)
);

create table if not exists public.classes (
  id            uuid        primary key default gen_random_uuid(),
  student_id    uuid        not null references public.students(id) on delete cascade,
  tutor_id      uuid        not null references public.tutors(id)   on delete cascade,
  subject       text        not null,
  topic         text,
  scheduled_at  timestamptz not null,
  -- combined date + start time
  duration_min  int         not null default 60,
  mode          text        not null default 'Online'
                            check (mode in ('Online','Offline')),
  meeting_link  text,
  location      text,
  status        text        not null default 'Scheduled'
                            check (status in ('Scheduled','Completed','Cancelled','Rescheduled')),
  attendance    text        not null default 'Pending'
                            check (attendance in ('Pending','Present','Absent','Cancelled')),
  payment_status text       not null default 'Unpaid'
                            check (payment_status in ('Unpaid','Paid','Partially Paid','Waived')),
  rate_qar      numeric(10,2),
  -- rate at time of class (snapshot from tutor.rate_qar)
  notes         text,
  -- quick internal note; full post-class notes go in class_notes
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.class_notes (
  id              uuid        primary key default gen_random_uuid(),
  class_id        uuid        references public.classes(id) on delete cascade,
  tutor_id        uuid        not null references public.tutors(id)  on delete cascade,
  student_id      uuid        not null references public.students(id) on delete cascade,
  topic           text,
  understanding   text        check (understanding in ('Excellent','Good','Fair','Needs Support')),
  strengths       text,
  areas_to_improve text,
  recommendation  text,
  summary         text,
  -- parent-friendly summary shown in parent portal
  is_shared_with_parent  boolean not null default true,
  is_shared_with_student boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.homework (
  id           uuid        primary key default gen_random_uuid(),
  class_id     uuid        references public.classes(id) on delete set null,
  tutor_id     uuid        not null references public.tutors(id)   on delete cascade,
  student_id   uuid        not null references public.students(id) on delete cascade,
  title        text        not null,
  description  text,
  due_at       timestamptz,
  file_url     text,
  -- Supabase Storage URL for attached file
  status       text        not null default 'Assigned'
                           check (status in ('Assigned','Submitted','Reviewed','Incomplete')),
  submission_url text,
  -- student's submission file URL
  tutor_feedback text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.invoices (
  id              uuid        primary key default gen_random_uuid(),
  parent_id       uuid        not null references public.parents(id)  on delete cascade,
  student_id      uuid        references public.students(id) on delete set null,
  invoice_number  text        not null,
  -- e.g. 'INV-2026-001'
  period_start    date,
  period_end      date,
  subtotal_qar    numeric(10,2) not null default 0,
  discount_qar    numeric(10,2) not null default 0,
  total_qar       numeric(10,2) not null default 0,
  paid_qar        numeric(10,2) not null default 0,
  balance_qar     numeric(10,2) generated always as (total_qar - paid_qar) stored,
  currency        text        not null default 'QAR',
  status          text        not null default 'Draft'
                              check (status in ('Draft','Issued','Partially Paid','Paid','Overdue','Cancelled')),
  issued_at       timestamptz,
  due_at          timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.payments (
  id             uuid        primary key default gen_random_uuid(),
  invoice_id     uuid        references public.invoices(id) on delete set null,
  parent_id      uuid        not null references public.parents(id)  on delete cascade,
  student_id     uuid        references public.students(id) on delete set null,
  tutor_id       uuid        references public.tutors(id)   on delete set null,
  amount_qar     numeric(10,2) not null,
  method         text        check (method in ('Cash','Bank Transfer','Card','Online','Cheque')),
  reference      text,
  -- bank ref / receipt number
  paid_at        timestamptz not null default now(),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.materials (
  id           uuid        primary key default gen_random_uuid(),
  tutor_id     uuid        references public.tutors(id)   on delete set null,
  -- null = uploaded by admin
  student_id   uuid        references public.students(id) on delete cascade,
  -- null = shared with all students of this tutor
  class_id     uuid        references public.classes(id)  on delete set null,
  -- null = not tied to a specific class
  title        text        not null,
  description  text,
  subject      text,
  file_url     text        not null,
  -- Supabase Storage URL
  file_type    text,
  -- e.g. 'PDF', 'Doc', 'Video', 'Link'
  is_public    boolean     not null default false,
  -- true = all students of this tutor can see it
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.assessment_requests (
  id              uuid        primary key default gen_random_uuid(),
  parent_name     text        not null,
  parent_email    text        not null,
  parent_phone    text,
  student_name    text        not null,
  student_age     int,
  student_grade   text,
  school          text,
  curriculum      text,
  subjects        text[]      not null default '{}',
  goals           text,
  preferred_mode  text        check (preferred_mode in ('Online','Offline','Either')),
  message         text,
  status          text        not null default 'New'
                              check (status in ('New','Contacted','Converted','Closed')),
  admin_notes     text,
  submitted_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.audit_logs (
 id uuid primary key default gen_random_uuid(),
 actor_user_id uuid references public.profiles(id), actor_name text, actor_role text,
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
 select coalesce(public.current_active_role() in ('super_admin','admin_tutor'), false)
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
drop policy if exists staff_read on public.tutors;create policy staff_read on public.tutors for select to authenticated using(public.is_admin());
drop policy if exists staff_insert on public.tutors;create policy staff_insert on public.tutors for insert to authenticated with check(public.is_admin());
drop policy if exists staff_update on public.tutors;create policy staff_update on public.tutors for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists super_delete on public.tutors;create policy super_delete on public.tutors for delete to authenticated using(public.current_active_role()='super_admin');
drop policy if exists admin_all on public.parents;
drop policy if exists staff_read on public.parents;create policy staff_read on public.parents for select to authenticated using(public.is_admin());
drop policy if exists staff_insert on public.parents;create policy staff_insert on public.parents for insert to authenticated with check(public.is_admin());
drop policy if exists staff_update on public.parents;create policy staff_update on public.parents for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists super_delete on public.parents;create policy super_delete on public.parents for delete to authenticated using(public.current_active_role()='super_admin');
drop policy if exists admin_all on public.students;
drop policy if exists staff_read on public.students;create policy staff_read on public.students for select to authenticated using(public.is_admin());
drop policy if exists staff_insert on public.students;create policy staff_insert on public.students for insert to authenticated with check(public.is_admin());
drop policy if exists staff_update on public.students;create policy staff_update on public.students for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists super_delete on public.students;create policy super_delete on public.students for delete to authenticated using(public.current_active_role()='super_admin');
drop policy if exists admin_all on public.student_tutors;
drop policy if exists staff_read on public.student_tutors;create policy staff_read on public.student_tutors for select to authenticated using(public.is_admin());
drop policy if exists staff_insert on public.student_tutors;create policy staff_insert on public.student_tutors for insert to authenticated with check(public.is_admin());
drop policy if exists staff_update on public.student_tutors;create policy staff_update on public.student_tutors for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists super_delete on public.student_tutors;create policy super_delete on public.student_tutors for delete to authenticated using(public.current_active_role()='super_admin');
drop policy if exists admin_all on public.classes;
drop policy if exists staff_read on public.classes;create policy staff_read on public.classes for select to authenticated using(public.is_admin());
drop policy if exists staff_insert on public.classes;create policy staff_insert on public.classes for insert to authenticated with check(public.is_admin());
drop policy if exists staff_update on public.classes;create policy staff_update on public.classes for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists super_delete on public.classes;create policy super_delete on public.classes for delete to authenticated using(public.current_active_role()='super_admin');
drop policy if exists admin_all on public.class_notes;
drop policy if exists staff_read on public.class_notes;create policy staff_read on public.class_notes for select to authenticated using(public.is_admin());
drop policy if exists staff_insert on public.class_notes;create policy staff_insert on public.class_notes for insert to authenticated with check(public.is_admin());
drop policy if exists staff_update on public.class_notes;create policy staff_update on public.class_notes for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists super_delete on public.class_notes;create policy super_delete on public.class_notes for delete to authenticated using(public.current_active_role()='super_admin');
drop policy if exists admin_all on public.homework;
drop policy if exists staff_read on public.homework;create policy staff_read on public.homework for select to authenticated using(public.is_admin());
drop policy if exists staff_insert on public.homework;create policy staff_insert on public.homework for insert to authenticated with check(public.is_admin());
drop policy if exists staff_update on public.homework;create policy staff_update on public.homework for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists super_delete on public.homework;create policy super_delete on public.homework for delete to authenticated using(public.current_active_role()='super_admin');
drop policy if exists admin_all on public.invoices;
drop policy if exists staff_read on public.invoices;create policy staff_read on public.invoices for select to authenticated using(public.is_admin());
drop policy if exists staff_insert on public.invoices;create policy staff_insert on public.invoices for insert to authenticated with check(public.is_admin());
drop policy if exists staff_update on public.invoices;create policy staff_update on public.invoices for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists super_delete on public.invoices;create policy super_delete on public.invoices for delete to authenticated using(public.current_active_role()='super_admin');
drop policy if exists admin_all on public.payments;
drop policy if exists staff_read on public.payments;create policy staff_read on public.payments for select to authenticated using(public.is_admin());
drop policy if exists staff_insert on public.payments;create policy staff_insert on public.payments for insert to authenticated with check(public.is_admin());
drop policy if exists staff_update on public.payments;create policy staff_update on public.payments for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists super_delete on public.payments;create policy super_delete on public.payments for delete to authenticated using(public.current_active_role()='super_admin');
drop policy if exists admin_all on public.materials;
drop policy if exists staff_read on public.materials;create policy staff_read on public.materials for select to authenticated using(public.is_admin());
drop policy if exists staff_insert on public.materials;create policy staff_insert on public.materials for insert to authenticated with check(public.is_admin());
drop policy if exists staff_update on public.materials;create policy staff_update on public.materials for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists super_delete on public.materials;create policy super_delete on public.materials for delete to authenticated using(public.current_active_role()='super_admin');
drop policy if exists admin_all on public.assessment_requests;
drop policy if exists staff_read on public.assessment_requests;create policy staff_read on public.assessment_requests for select to authenticated using(public.is_admin());
drop policy if exists staff_insert on public.assessment_requests;create policy staff_insert on public.assessment_requests for insert to authenticated with check(public.is_admin());
drop policy if exists staff_update on public.assessment_requests;create policy staff_update on public.assessment_requests for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists super_delete on public.assessment_requests;create policy super_delete on public.assessment_requests for delete to authenticated using(public.current_active_role()='super_admin');
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
create policy admin_read on public.audit_logs for select to authenticated using (public.current_active_role()='super_admin');
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
commit;

