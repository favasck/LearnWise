# Owner launch checklist

The public website can open while the account service is down. Signing in and saving forms need a working Supabase project. The last production project address no longer resolves. No live database or deployment changes were made in this work.

## 1. Bring the account service back

- Open your Supabase dashboard. Restore the LearnWise project if it is paused and restoration is available.
- If it has been deleted, create a new project. A new project starts empty; it does not recover your old users or records. Use your backups if you need the old data.
- Keep the database password private. You do not need to give the website a service-role key.

## 2. Set up an empty database

For a new, empty project, open Supabase > SQL Editor. Open each file in this repository, copy its entire contents, paste into a new query, and click Run. Use this exact order, even though the dates in the filenames sort differently:

1. `migrations/202611070001_bootstrap_schema.sql`
2. `migrations/202611030001_protect_profile_updates.sql`

The first file creates the tables and access rules. The second locks down account permissions and records administrator permission changes. Run the second file only once. Do not use `supabase_setup.sql`.

If you restored a project that already contains tables or permission rules, have the supervising developer compare its structure first. These files were tested together on an empty database; the first file does not replace every possible older access rule. If either query fails, keep the error for your developer. Do not remove security statements to make it run.

## 3. Connect Vercel and rebuild

- In Supabase, find your project's URL and public anon key in its connection/API settings. Copy them from your own project.
- In Vercel, open the LearnWise project > Settings > Environment Variables.
- Set `VITE_SUPABASE_URL` to the project URL.
- Set `VITE_SUPABASE_ANON_KEY` to its public anon key. Never use a service-role or secret key here.
- Enable both **Production** and **Preview** for both variables. Preview currently has neither variable. A separate test Supabase project for Preview is preferable; otherwise preview changes can affect your real records.
- Redeploy Production and the Preview you want to test. Changing a variable alone does not update an already built website.
- In Supabase Authentication > URL Configuration, set the Site URL to your production website. Add your intended production and preview callback addresses to Redirect URLs so email confirmation can return to the site.

## 4. Create your first administrator

In Supabase > Authentication > Users, use Add user to create your own email/password account and confirm the email. Use an email you control. The signup trigger creates its profile.

Then open SQL Editor. In the query below, replace only `YOUR-ADMIN-EMAIL-HERE` with that exact email and run it. The query refuses to continue if the email is missing, ambiguous, or an active administrator already exists.

```sql
do $$
declare
  target_id uuid;
  matching_users integer;
begin
  if exists (select 1 from public.profiles where role = 'admin' and status = 'Active') then
    raise exception 'An active administrator already exists. Use that account.';
  end if;
  select count(*) into matching_users from auth.users
    where lower(email) = lower('YOUR-ADMIN-EMAIL-HERE');
  if matching_users <> 1 then
    raise exception 'Create exactly one confirmed user with this email first.';
  end if;
  select id into target_id from auth.users
    where lower(email) = lower('YOUR-ADMIN-EMAIL-HERE') and email_confirmed_at is not null;
  if target_id is null then
    raise exception 'Confirm the user email first.';
  end if;
  insert into public.profiles (id, full_name, email, role, status)
    select id, coalesce(raw_user_meta_data->>'full_name', email), email, 'student', 'Active'
    from auth.users where id = target_id
    on conflict (id) do nothing;
  update public.profiles set role = 'admin', status = 'Active' where id = target_id;
end;
$$;
```

Sign in through Staff Access. This initial database setup uses the existing `admin` role. Do not choose `super_admin` or `admin_tutor`; their separate permissions are not implemented. Later changes to other accounts must use the app's protected administrator action. Administrators cannot change their own permissions there.

Create the tutor, parent and student records in the admin portal. Have each person sign up with their matching role, then use Users to link each account to its record. Assign the tutor to the student and link the student to the parent. Signing up alone does not make these links.

## 5. Let visitors open production

In Vercel > Settings > Deployment Protection, set **Vercel Authentication** to **Only Preview Deployments**. Save. Open production in a private browser window where you are signed out of Vercel. It should open the academy website. Preview should still require the intended protection.

## 6. Try each role using test records

Use separate accounts and a private browser window between roles. Reload after every save to check it stayed saved. Start with invented test details, not real children's private information.

- **Public visitor:** Open Home, About, Subjects, IGCSE, Online, Assessment and Contact. Send one assessment and one contact message. Check both arrive in the admin assessment list. Try a wrong password. Temporarily block the Supabase request in your browser and check the public pages still open, and forms/sign-in show a temporary service message. Restore the connection before continuing.
- **Admin:** Sign in through Staff Access. Add a parent, student and tutor; link their accounts; assign the tutor. Create a class, record attendance, add a note, assign homework and add a material link. Create and issue an invoice, record a small test payment and check the parent's balance after reload. Open reports and audit logs. Change another test account's role/status and check `permission_audit_events` in Supabase Table Editor. Suspend it and confirm its next data request is denied. General audit logs do not yet show every action.
- **Tutor:** See only assigned students/classes. Mark attendance. Create, edit and review homework; add notes and choose who can see them; add a material link. Check a second tutor cannot see these students. Have admin remove the assignment and check access disappears on the next request.
- **Parent:** See only linked children, their classes, homework, shared progress notes, invoices and payments. Check private notes and another family's records are absent. Parent screens are read-only.
- **Student:** See only their own classes, homework, permitted materials and shared progress notes. Open a meeting/material link. Check another student's records and notes not shared with students are absent. Homework upload/submission is not yet available in this portal.

## Work still needed before a full tuition launch

Restoring the service is necessary, but it does not finish these larger features. See [the feature audit](FEATURE-AUDIT.md) for source references.

- Decide and implement the separate Super Admin and Tutor Admin roles. Existing legacy admin access is preserved; these new roles are not silently granted.
- Protect private fields inside shared records. Current rules limit which rows families/tutors can read, but internal notes and some billing/contact fields remain in those rows. Do not enter sensitive internal information until the developer separates permitted fields and verifies the result.
- Add recurring lessons, exceptions, automatic conflict checks, cancellation rules and make-up lessons. Current scheduling saves individual lessons only.
- Make payments and invoice balances update together, prevent duplicate payments/invoice numbers, keep correction history, and connect charges to lessons/packages. Current payment recording uses separate requests; avoid live billing until this is completed and tested. A timeout can leave a save uncertain: check existing records before retrying.
- Add the curriculum hierarchy, resource ownership/rights details and protected file storage. Current materials save links; they do not upload or protect files. Confirm you have permission to share every resource.
- Add real assessment evidence and mastery calculations. Current assessment form collects enquiries; progress screens show notes and homework.
- Complete student homework submission, persistent academy settings, and automatic audit records for sensitive operations. Settings currently has no working save. Permission changes are recorded separately from the general audit screen.
- Confirm the displayed contact number, email, hours and 24-hour response promise before advertising them.
- Finish live tests after the project is restored. Local checks cannot prove email delivery, real portal access, browser appearance or deployment settings.
- Messaging, payment gateways and the independent tutor marketplace are future work. They are not connected.

No credentials, service settings or production data were changed by this task. Claude Code must review the pending files, create the separate commits and push them; this workspace denies writes to `.git`.
