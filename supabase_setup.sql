-- LearnWise Academy — Supabase setup
-- Run this once in your Supabase project's SQL editor (Database > SQL Editor).

-- 1. Profiles table: one row per signed-up user, holding their role.
create table if not exists public.profiles (
  id uuid references auth.users (id) on delete cascade primary key,
  full_name text not null,
  email text not null,
  role text not null default 'student' check (role in ('admin', 'tutor', 'parent', 'student')),
  phone text,
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 2. Auto-create a profile row whenever someone signs up.
-- The role comes from the "role" field passed in signUp's options.data,
-- and always defaults to a non-admin role — admin can never be self-assigned
-- through the public sign-up form.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    case
      when new.raw_user_meta_data->>'role' in ('tutor', 'parent', 'student')
        then new.raw_user_meta_data->>'role'
      else 'student'
    end
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Row Level Security policies.
-- Everyone can read their own profile.
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Everyone can update their own profile (but not their own role — enforced in app logic
-- plus the admin-only policy below for changing other people's roles).
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Admins can view every profile (powers the admin "All Users" dashboard).
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can update any profile (e.g. to promote someone or deactivate an account).
create policy "Admins can update all profiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- 4. Create your first admin account:
--    a) Sign up normally through the app (you'll land in the Student/Tutor/Parent
--       portal depending on what you picked).
--    b) In the Supabase Table Editor, open "profiles", find your row, and change
--       "role" to admin. Or run:
--    update public.profiles set role = 'admin' where email = 'you@example.com';
--    c) Sign out and back in — you'll now land in the Admin portal.
