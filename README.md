# LearnWise Academy

Tutoring management platform MVP — Admin, Tutor, Parent, and Student portals,
with real sign-up / sign-in and an admin dashboard of every registered user.

Authentication and accounts run on Supabase. Day-to-day tutoring data
(students, classes, payments, etc.) still uses in-memory placeholder data —
swap that for real tables when you're ready; the shapes already match the
schema discussed earlier.

## 1. Create a Supabase project

1. Go to supabase.com, create a free project.
2. In Project Settings -> API, copy the Project URL and anon public key.
3. Copy `.env.example` to `.env` and paste them in:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
4. In SQL Editor, paste and run everything in `supabase_setup.sql`. This creates:
   - a `profiles` table (name, email, role, status) - one row per user
   - a trigger that auto-creates a profile when someone signs up
   - row-level security so users can only see their own profile, and admins can see everyone's

## 2. Create your first admin account

Public sign-up only allows Tutor / Parent / Student - admin can't be
self-assigned through the UI. To create your first admin:

1. Sign up normally through the app with the account you want as admin.
2. In Supabase, go to Table Editor -> profiles, find your row, change `role` to `admin`.
   Or run in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
3. Sign out of the app, then sign back in through the small "." link at the
   bottom of the sign-in page -> "Staff Access" -> sign in with that account.
   You'll land in the full Admin portal, including "All Users", where you
   can see every signed-up account and promote/suspend others from there on.

## 3. Run locally

```bash
npm install
npm run dev
```

## 4. Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel: Add New Project -> import the repo -> Framework preset Vite.
3. Add the same two environment variables (VITE_SUPABASE_URL,
   VITE_SUPABASE_ANON_KEY) under Project Settings -> Environment Variables.
4. Deploy. Build command `npm run build`, output directory `dist` (both default).

`vercel.json` already includes an SPA rewrite so client-side routes don't 404 on refresh.

## What's real vs. placeholder

- Real: sign up, sign in, sessions, roles, the admin "All Users" list, suspend/promote actions.
- Placeholder (in-memory): students, tutors, parents, classes, attendance, homework, payments, reports - these reset on every page reload. Wiring these to Supabase tables is the natural next step, following the schema from the original brief.
