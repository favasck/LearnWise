-- ============================================================
-- LearnWise Academy — Complete Supabase Setup
-- ============================================================
-- HOW TO RUN:
--   Paste this entire file into Supabase → SQL Editor and run.
--   It is safe to re-run: all statements use IF NOT EXISTS or
--   CREATE OR REPLACE, and DROP IF EXISTS before recreating
--   triggers/policies so there are no duplicate-name errors.
--
-- TABLES (in dependency order):
--   profiles           (auth.users extension — already exists)
--   tutors             (tutor profiles, linked to auth.users)
--   parents            (parent profiles, linked to auth.users)
--   students           (student records, linked to a parent)
--   student_tutors     (many-to-many: students ↔ tutors)
--   classes            (scheduled/completed sessions)
--   class_notes        (tutor's post-class notes)
--   homework           (assignments per class)
--   invoices           (billing records per parent)
--   payments           (payments against invoices)
--   materials          (uploaded study resources)
--   assessment_requests (public inquiry form)
-- ============================================================


-- ============================================================
-- 0. EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";


-- ============================================================
-- 1. HELPER FUNCTIONS
-- ============================================================

-- is_admin(): checks the current user's role via JWT claim.
-- Using (select role from profiles) inside policies causes
-- infinite recursion on the profiles table itself, so we
-- read from the JWT metadata instead.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin'
       from public.profiles
      where id = auth.uid()),
    false
  );
$$;

-- updated_at trigger function — reused by all tables.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- 2. PROFILES  (keep existing, add updated_at + improve check)
-- ============================================================
create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  full_name   text        not null,
  email       text        not null,
  role        text        not null default 'student'
                          check (role in ('admin','tutor','parent','student')),
  phone       text,
  status      text        not null default 'Active'
                          check (status in ('Active','Suspended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Add updated_at column if upgrading from old schema
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Drop old policies before recreating (avoids duplicate-name errors on re-run)
drop policy if exists "Users can view their own profile"   on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admins can view all profiles"       on public.profiles;
drop policy if exists "Admins can update all profiles"     on public.profiles;

create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id);

-- Admin policies use is_admin() to avoid recursion
create policy "profiles: admin read all"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles: admin update all"
  on public.profiles for update
  using (public.is_admin());


-- Auto-create profile on sign-up (keep existing trigger, recreate cleanly)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    case
      when new.raw_user_meta_data->>'role' in ('tutor','parent','student')
        then new.raw_user_meta_data->>'role'
      else 'student'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 3. TUTORS
-- ============================================================
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

drop trigger if exists trg_tutors_updated_at on public.tutors;
create trigger trg_tutors_updated_at
  before update on public.tutors
  for each row execute function public.set_updated_at();

alter table public.tutors enable row level security;

drop policy if exists "tutors: admin all"     on public.tutors;
drop policy if exists "tutors: own read"      on public.tutors;
drop policy if exists "tutors: student read"  on public.tutors;
drop policy if exists "tutors: parent read"   on public.tutors;

create policy "tutors: admin all"
  on public.tutors for all
  using (public.is_admin());

-- Tutor can read and update their own record
create policy "tutors: own read"
  on public.tutors for select
  using (user_id = auth.uid());

create policy "tutors: own update"
  on public.tutors for update
  using (user_id = auth.uid());

-- Students can see their assigned tutors (via student_tutors join)
create policy "tutors: student read assigned"
  on public.tutors for select
  using (
    exists (
      select 1 from public.student_tutors st
      join public.students s on s.id = st.student_id
      where st.tutor_id = tutors.id
        and s.user_id = auth.uid()
    )
  );

-- Parents can see tutors assigned to their children
create policy "tutors: parent read assigned"
  on public.tutors for select
  using (
    exists (
      select 1 from public.student_tutors st
      join public.students s on s.id = st.student_id
      join public.parents  p on p.id = s.parent_id
      where st.tutor_id = tutors.id
        and p.user_id = auth.uid()
    )
  );


-- ============================================================
-- 4. PARENTS
-- ============================================================
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

drop trigger if exists trg_parents_updated_at on public.parents;
create trigger trg_parents_updated_at
  before update on public.parents
  for each row execute function public.set_updated_at();

alter table public.parents enable row level security;

drop policy if exists "parents: admin all"  on public.parents;
drop policy if exists "parents: own read"   on public.parents;
drop policy if exists "parents: own update" on public.parents;

create policy "parents: admin all"
  on public.parents for all
  using (public.is_admin());

create policy "parents: own read"
  on public.parents for select
  using (user_id = auth.uid());

create policy "parents: own update"
  on public.parents for update
  using (user_id = auth.uid());


-- ============================================================
-- 5. STUDENTS
-- ============================================================
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

drop trigger if exists trg_students_updated_at on public.students;
create trigger trg_students_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

alter table public.students enable row level security;

drop policy if exists "students: admin all"          on public.students;
drop policy if exists "students: own read"           on public.students;
drop policy if exists "students: parent read"        on public.students;
drop policy if exists "students: tutor read assigned" on public.students;

create policy "students: admin all"
  on public.students for all
  using (public.is_admin());

create policy "students: own read"
  on public.students for select
  using (user_id = auth.uid());

create policy "students: parent read"
  on public.students for select
  using (
    exists (
      select 1 from public.parents p
      where p.id = students.parent_id
        and p.user_id = auth.uid()
    )
  );

create policy "students: tutor read assigned"
  on public.students for select
  using (
    exists (
      select 1 from public.student_tutors st
      join public.tutors t on t.id = st.tutor_id
      where st.student_id = students.id
        and t.user_id = auth.uid()
    )
  );


-- ============================================================
-- 6. STUDENT_TUTORS  (many-to-many join table)
-- ============================================================
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

alter table public.student_tutors enable row level security;

drop policy if exists "student_tutors: admin all"   on public.student_tutors;
drop policy if exists "student_tutors: tutor read"  on public.student_tutors;
drop policy if exists "student_tutors: student read" on public.student_tutors;
drop policy if exists "student_tutors: parent read"  on public.student_tutors;

create policy "student_tutors: admin all"
  on public.student_tutors for all
  using (public.is_admin());

create policy "student_tutors: tutor read own"
  on public.student_tutors for select
  using (
    exists (
      select 1 from public.tutors t
      where t.id = student_tutors.tutor_id
        and t.user_id = auth.uid()
    )
  );

create policy "student_tutors: student read own"
  on public.student_tutors for select
  using (
    exists (
      select 1 from public.students s
      where s.id = student_tutors.student_id
        and s.user_id = auth.uid()
    )
  );

create policy "student_tutors: parent read"
  on public.student_tutors for select
  using (
    exists (
      select 1 from public.students s
      join public.parents p on p.id = s.parent_id
      where s.id = student_tutors.student_id
        and p.user_id = auth.uid()
    )
  );


-- ============================================================
-- 7. CLASSES
-- ============================================================
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

drop trigger if exists trg_classes_updated_at on public.classes;
create trigger trg_classes_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

alter table public.classes enable row level security;

drop policy if exists "classes: admin all"          on public.classes;
drop policy if exists "classes: tutor read own"     on public.classes;
drop policy if exists "classes: tutor update own"   on public.classes;
drop policy if exists "classes: student read own"   on public.classes;
drop policy if exists "classes: parent read"        on public.classes;

create policy "classes: admin all"
  on public.classes for all
  using (public.is_admin());

create policy "classes: tutor read own"
  on public.classes for select
  using (
    exists (
      select 1 from public.tutors t
      where t.id = classes.tutor_id
        and t.user_id = auth.uid()
    )
  );

-- Tutors can update attendance and status on their own classes
create policy "classes: tutor update own"
  on public.classes for update
  using (
    exists (
      select 1 from public.tutors t
      where t.id = classes.tutor_id
        and t.user_id = auth.uid()
    )
  );

create policy "classes: student read own"
  on public.classes for select
  using (
    exists (
      select 1 from public.students s
      where s.id = classes.student_id
        and s.user_id = auth.uid()
    )
  );

create policy "classes: parent read"
  on public.classes for select
  using (
    exists (
      select 1 from public.students s
      join public.parents p on p.id = s.parent_id
      where s.id = classes.student_id
        and p.user_id = auth.uid()
    )
  );


-- ============================================================
-- 8. CLASS_NOTES  (post-class progress notes written by tutor)
-- ============================================================
create table if not exists public.class_notes (
  id              uuid        primary key default gen_random_uuid(),
  class_id        uuid        not null references public.classes(id) on delete cascade,
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

drop trigger if exists trg_class_notes_updated_at on public.class_notes;
create trigger trg_class_notes_updated_at
  before update on public.class_notes
  for each row execute function public.set_updated_at();

alter table public.class_notes enable row level security;

drop policy if exists "class_notes: admin all"         on public.class_notes;
drop policy if exists "class_notes: tutor own"         on public.class_notes;
drop policy if exists "class_notes: parent read shared" on public.class_notes;
drop policy if exists "class_notes: student read shared" on public.class_notes;

create policy "class_notes: admin all"
  on public.class_notes for all
  using (public.is_admin());

create policy "class_notes: tutor own"
  on public.class_notes for all
  using (
    exists (
      select 1 from public.tutors t
      where t.id = class_notes.tutor_id
        and t.user_id = auth.uid()
    )
  );

create policy "class_notes: parent read shared"
  on public.class_notes for select
  using (
    is_shared_with_parent = true
    and exists (
      select 1 from public.students s
      join public.parents p on p.id = s.parent_id
      where s.id = class_notes.student_id
        and p.user_id = auth.uid()
    )
  );

create policy "class_notes: student read shared"
  on public.class_notes for select
  using (
    is_shared_with_student = true
    and exists (
      select 1 from public.students s
      where s.id = class_notes.student_id
        and s.user_id = auth.uid()
    )
  );


-- ============================================================
-- 9. HOMEWORK
-- ============================================================
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

drop trigger if exists trg_homework_updated_at on public.homework;
create trigger trg_homework_updated_at
  before update on public.homework
  for each row execute function public.set_updated_at();

alter table public.homework enable row level security;

drop policy if exists "homework: admin all"        on public.homework;
drop policy if exists "homework: tutor own"        on public.homework;
drop policy if exists "homework: student read own" on public.homework;
drop policy if exists "homework: student submit"   on public.homework;
drop policy if exists "homework: parent read"      on public.homework;

create policy "homework: admin all"
  on public.homework for all
  using (public.is_admin());

create policy "homework: tutor own"
  on public.homework for all
  using (
    exists (
      select 1 from public.tutors t
      where t.id = homework.tutor_id
        and t.user_id = auth.uid()
    )
  );

create policy "homework: student read own"
  on public.homework for select
  using (
    exists (
      select 1 from public.students s
      where s.id = homework.student_id
        and s.user_id = auth.uid()
    )
  );

-- Students can update their own homework (to submit)
create policy "homework: student submit"
  on public.homework for update
  using (
    exists (
      select 1 from public.students s
      where s.id = homework.student_id
        and s.user_id = auth.uid()
    )
  );

create policy "homework: parent read"
  on public.homework for select
  using (
    exists (
      select 1 from public.students s
      join public.parents p on p.id = s.parent_id
      where s.id = homework.student_id
        and p.user_id = auth.uid()
    )
  );


-- ============================================================
-- 10. INVOICES  (billing record per parent, covering one or more classes)
-- ============================================================
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

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;

drop policy if exists "invoices: admin all"    on public.invoices;
drop policy if exists "invoices: parent read"  on public.invoices;

create policy "invoices: admin all"
  on public.invoices for all
  using (public.is_admin());

create policy "invoices: parent read own"
  on public.invoices for select
  using (
    exists (
      select 1 from public.parents p
      where p.id = invoices.parent_id
        and p.user_id = auth.uid()
    )
  );


-- ============================================================
-- 11. PAYMENTS  (individual payment transactions against invoices)
-- ============================================================
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

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

drop policy if exists "payments: admin all"   on public.payments;
drop policy if exists "payments: parent read" on public.payments;

create policy "payments: admin all"
  on public.payments for all
  using (public.is_admin());

create policy "payments: parent read own"
  on public.payments for select
  using (
    exists (
      select 1 from public.parents p
      where p.id = payments.parent_id
        and p.user_id = auth.uid()
    )
  );


-- ============================================================
-- 12. MATERIALS  (study resources uploaded by tutors or admins)
-- ============================================================
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

drop trigger if exists trg_materials_updated_at on public.materials;
create trigger trg_materials_updated_at
  before update on public.materials
  for each row execute function public.set_updated_at();

alter table public.materials enable row level security;

drop policy if exists "materials: admin all"         on public.materials;
drop policy if exists "materials: tutor own"         on public.materials;
drop policy if exists "materials: student read own"  on public.materials;
drop policy if exists "materials: parent read"       on public.materials;

create policy "materials: admin all"
  on public.materials for all
  using (public.is_admin());

create policy "materials: tutor own"
  on public.materials for all
  using (
    exists (
      select 1 from public.tutors t
      where t.id = materials.tutor_id
        and t.user_id = auth.uid()
    )
  );

-- Student sees materials targeted at them OR public materials from their tutor
create policy "materials: student read own"
  on public.materials for select
  using (
    exists (
      select 1 from public.students s
      join public.student_tutors st on st.student_id = s.id
      where s.user_id = auth.uid()
        and (
          materials.student_id = s.id
          or (materials.is_public = true and materials.tutor_id = st.tutor_id)
        )
    )
  );

create policy "materials: parent read"
  on public.materials for select
  using (
    exists (
      select 1 from public.students s
      join public.parents p on p.id = s.parent_id
      where p.user_id = auth.uid()
        and (
          materials.student_id = s.id
          or (materials.is_public = true and exists (
            select 1 from public.student_tutors st
            where st.student_id = s.id and st.tutor_id = materials.tutor_id
          ))
        )
    )
  );


-- ============================================================
-- 13. ASSESSMENT_REQUESTS  (public inquiry / onboarding form)
-- ============================================================
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

drop trigger if exists trg_assessment_requests_updated_at on public.assessment_requests;
create trigger trg_assessment_requests_updated_at
  before update on public.assessment_requests
  for each row execute function public.set_updated_at();

alter table public.assessment_requests enable row level security;

drop policy if exists "assessment_requests: admin all"    on public.assessment_requests;
drop policy if exists "assessment_requests: public insert" on public.assessment_requests;

-- Admin can read, update, delete all requests
create policy "assessment_requests: admin all"
  on public.assessment_requests for all
  using (public.is_admin());

-- Anyone (including unauthenticated visitors) can submit a request
create policy "assessment_requests: public insert"
  on public.assessment_requests for insert
  with check (true);


-- ============================================================
-- 14. USEFUL INDEXES  (query performance for common lookups)
-- ============================================================
create index if not exists idx_tutors_user_id          on public.tutors(user_id);
create index if not exists idx_parents_user_id         on public.parents(user_id);
create index if not exists idx_students_user_id        on public.students(user_id);
create index if not exists idx_students_parent_id      on public.students(parent_id);
create index if not exists idx_student_tutors_student  on public.student_tutors(student_id);
create index if not exists idx_student_tutors_tutor    on public.student_tutors(tutor_id);
create index if not exists idx_classes_student_id      on public.classes(student_id);
create index if not exists idx_classes_tutor_id        on public.classes(tutor_id);
create index if not exists idx_classes_scheduled_at    on public.classes(scheduled_at);
create index if not exists idx_class_notes_class_id    on public.class_notes(class_id);
create index if not exists idx_class_notes_student_id  on public.class_notes(student_id);
create index if not exists idx_homework_student_id     on public.homework(student_id);
create index if not exists idx_homework_tutor_id       on public.homework(tutor_id);
create index if not exists idx_homework_due_at         on public.homework(due_at);
create index if not exists idx_invoices_parent_id      on public.invoices(parent_id);
create index if not exists idx_payments_parent_id      on public.payments(parent_id);
create index if not exists idx_materials_tutor_id      on public.materials(tutor_id);
create index if not exists idx_materials_student_id    on public.materials(student_id);


-- ============================================================
-- HOW TO CREATE YOUR FIRST ADMIN ACCOUNT
-- ============================================================
-- 1. Sign up normally through the app.
-- 2. Run this in the SQL editor (replace the email):
--
--    update public.profiles
--    set role = 'admin'
--    where email = 'you@example.com';
--
-- 3. Sign out and back in — you will land in the Admin portal.
--
-- HOW TO LINK AN AUTH ACCOUNT TO A TUTOR/PARENT/STUDENT RECORD
-- ============================================================
-- After a tutor/parent/student signs up, an admin runs:
--
--    -- For a tutor:
--    update public.tutors
--    set user_id = (select id from auth.users where email = 'tutor@example.com')
--    where full_name = 'Sarah Whitfield';
--
--    -- For a parent:
--    update public.parents
--    set user_id = (select id from auth.users where email = 'parent@example.com')
--    where full_name = 'Mariam Al-Sayed';
--
--    -- For a student:
--    update public.students
--    set user_id = (select id from auth.users where email = 'student@example.com')
--    where full_name = 'Yusuf Al-Sayed';
--
-- Once linked, the user's portal will show their real data.
-- ============================================================
