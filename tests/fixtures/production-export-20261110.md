# LearnWise production export (project jllisbpzphxhbqqdpvtz), 10 Nov 2026

Source: read-only queries in the Supabase SQL Editor (pg_policies, pg_proc) by Claude Code at Fawaz's request. No personal data. This is the exact live state, so use it instead of the reconstructed fixture.

## Changes already made to production on 10 Nov (by Fawaz, approved)
- `drop policy "profiles: admin all" on public.profiles;` (it trusted JWT user_metadata.role)
- `alter table public.students add column if not exists date_of_birth date;`
- Verified afterwards: 0 policies reference user_metadata; RLS is on for every public table; date_of_birth exists.
- Do not re-add either. Your migrations must work on this current state (use `drop policy if exists`, `add column if not exists`).

## Policies (schema public). Format: table | name | cmd | roles | USING | CHECK
All are PERMISSIVE, so on any table the rules are OR-ed together.

```
assessment_requests | assess: admin all | ALL | public | USING: is_admin() | CHECK: -
assessment_requests | assess: public insert | INSERT | public | USING: - | CHECK: true
assessment_requests | assessment_requests: admin_tutor read | SELECT | public | USING: is_admin_tutor() | CHECK: -
assessment_requests | assessment_requests: admin_tutor update | UPDATE | public | USING: is_admin_tutor() | CHECK: -
assessment_requests | assessment_requests: super_admin all | ALL | public | USING: is_super_admin() | CHECK: -
audit_logs | audit_logs: staff insert | INSERT | public | USING: - | CHECK: is_staff()
audit_logs | audit_logs: super_admin read | SELECT | public | USING: is_super_admin() | CHECK: -
class_notes | class_notes: admin_tutor insert | INSERT | public | USING: - | CHECK: is_admin_tutor()
class_notes | class_notes: admin_tutor read | SELECT | public | USING: is_admin_tutor() | CHECK: -
class_notes | class_notes: admin_tutor update | UPDATE | public | USING: is_admin_tutor() | CHECK: -
class_notes | class_notes: super_admin all | ALL | public | USING: is_super_admin() | CHECK: -
class_notes | notes: admin all | ALL | public | USING: is_admin() | CHECK: -
class_notes | notes: parent read | SELECT | public | USING: ((is_shared_with_parent = true) AND (EXISTS ( SELECT 1 FROM (students s JOIN parents p ON ((p.id = s.parent_id))) WHERE ((s.id = class_notes.student_id) AND (p.user_id = auth.uid()))))) | CHECK: -
class_notes | notes: student read | SELECT | public | USING: ((is_shared_with_student = true) AND (EXISTS ( SELECT 1 FROM students s WHERE ((s.id = class_notes.student_id) AND (s.user_id = auth.uid()))))) | CHECK: -
class_notes | notes: tutor all | ALL | public | USING: (EXISTS ( SELECT 1 FROM tutors t WHERE ((t.id = class_notes.tutor_id) AND (t.user_id = auth.uid())))) | CHECK: -
classes | classes: admin_tutor insert | INSERT | public | USING: - | CHECK: is_admin_tutor()
classes | classes: admin_tutor read | SELECT | public | USING: is_admin_tutor() | CHECK: -
classes | classes: admin_tutor update | UPDATE | public | USING: is_admin_tutor() | CHECK: -
classes | classes: parent read | SELECT | public | USING: (EXISTS ( SELECT 1 FROM (students s JOIN parents p ON ((p.id = s.parent_id))) WHERE ((s.id = classes.student_id) AND (p.user_id = auth.uid())))) | CHECK: -
classes | classes: student read | SELECT | public | USING: (EXISTS ( SELECT 1 FROM students s WHERE ((s.id = classes.student_id) AND (s.user_id = auth.uid())))) | CHECK: -
classes | classes: super_admin all | ALL | public | USING: is_super_admin() | CHECK: -
classes | classes: tutor all | ALL | public | USING: (EXISTS ( SELECT 1 FROM tutors t WHERE ((t.id = classes.tutor_id) AND (t.user_id = auth.uid())))) | CHECK: -
homework | homework: admin_tutor insert | INSERT | public | USING: - | CHECK: is_admin_tutor()
homework | homework: admin_tutor read | SELECT | public | USING: is_admin_tutor() | CHECK: -
homework | homework: admin_tutor update | UPDATE | public | USING: is_admin_tutor() | CHECK: -
homework | homework: parent read | SELECT | public | USING: (EXISTS ( SELECT 1 FROM (students s JOIN parents p ON ((p.id = s.parent_id))) WHERE ((s.id = homework.student_id) AND (p.user_id = auth.uid())))) | CHECK: -
homework | homework: student read | SELECT | public | USING: (EXISTS ( SELECT 1 FROM students s WHERE ((s.id = homework.student_id) AND (s.user_id = auth.uid())))) | CHECK: -
homework | homework: super_admin all | ALL | public | USING: is_super_admin() | CHECK: -
homework | homework: tutor all | ALL | public | USING: (EXISTS ( SELECT 1 FROM tutors t WHERE ((t.id = homework.tutor_id) AND (t.user_id = auth.uid())))) | CHECK: -
invoices | invoices: admin_tutor insert | INSERT | public | USING: - | CHECK: is_admin_tutor()
invoices | invoices: admin_tutor read | SELECT | public | USING: is_admin_tutor() | CHECK: -
invoices | invoices: admin_tutor update | UPDATE | public | USING: is_admin_tutor() | CHECK: -
invoices | invoices: parent read | SELECT | public | USING: (EXISTS ( SELECT 1 FROM parents p WHERE ((p.id = invoices.parent_id) AND (p.user_id = auth.uid())))) | CHECK: -
invoices | invoices: super_admin all | ALL | public | USING: is_super_admin() | CHECK: -
materials | materials: admin_tutor insert | INSERT | public | USING: - | CHECK: is_admin_tutor()
materials | materials: admin_tutor read | SELECT | public | USING: is_admin_tutor() | CHECK: -
materials | materials: admin_tutor update | UPDATE | public | USING: is_admin_tutor() | CHECK: -
materials | materials: parent read | SELECT | public | USING: ((is_public = true) OR (EXISTS ( SELECT 1 FROM (students s JOIN parents p ON ((p.id = s.parent_id))) WHERE ((s.id = materials.student_id) AND (p.user_id = auth.uid()))))) | CHECK: -
materials | materials: student read | SELECT | public | USING: ((is_public = true) OR (EXISTS ( SELECT 1 FROM students s WHERE ((s.id = materials.student_id) AND (s.user_id = auth.uid()))))) | CHECK: -
materials | materials: super_admin all | ALL | public | USING: is_super_admin() | CHECK: -
materials | materials: tutor all | ALL | public | USING: (EXISTS ( SELECT 1 FROM tutors t WHERE ((t.id = materials.tutor_id) AND (t.user_id = auth.uid())))) | CHECK: -
parents | parents: admin_tutor insert | INSERT | public | USING: - | CHECK: is_admin_tutor()
parents | parents: admin_tutor read | SELECT | public | USING: is_admin_tutor() | CHECK: -
parents | parents: admin_tutor update | UPDATE | public | USING: is_admin_tutor() | CHECK: -
parents | parents: own update | UPDATE | public | USING: (user_id = auth.uid()) | CHECK: -
parents | parents: super_admin all | ALL | public | USING: is_super_admin() | CHECK: -
parents | parents_admin_all | ALL | public | USING: is_admin() | CHECK: -
parents | parents_own_read | SELECT | public | USING: (user_id = auth.uid()) | CHECK: -
parents | parents_own_update | UPDATE | public | USING: (user_id = auth.uid()) | CHECK: -
payments | payments: admin_tutor insert | INSERT | public | USING: - | CHECK: is_admin_tutor()
payments | payments: admin_tutor read | SELECT | public | USING: is_admin_tutor() | CHECK: -
payments | payments: parent read | SELECT | public | USING: (EXISTS ( SELECT 1 FROM parents p WHERE ((p.id = payments.parent_id) AND (p.user_id = auth.uid())))) | CHECK: -
payments | payments: super_admin all | ALL | public | USING: is_super_admin() | CHECK: -
profiles | profiles: admin_tutor read all | SELECT | public | USING: is_admin_tutor() | CHECK: -
profiles | profiles: admin_tutor update safe fields | UPDATE | public | USING: is_admin_tutor() | CHECK: ((role = ( SELECT profiles_1.role FROM profiles profiles_1 WHERE (profiles_1.id = profiles_1.id))) AND (status = ( SELECT profiles_1.status FROM profiles profiles_1 WHERE (profiles_1.id = profiles_1.id))))
profiles | profiles: own insert | INSERT | public | USING: - | CHECK: (id = auth.uid())
profiles | profiles: own read | SELECT | public | USING: (auth.uid() = id) | CHECK: -
profiles | profiles: own update safe fields | UPDATE | public | USING: (auth.uid() = id) | CHECK: ((role = ( SELECT profiles_1.role FROM profiles profiles_1 WHERE (profiles_1.id = auth.uid()))) AND (status = ( SELECT profiles_1.status FROM profiles profiles_1 WHERE (profiles_1.id = auth.uid()))))
profiles | profiles: super_admin insert | INSERT | public | USING: - | CHECK: is_super_admin()
profiles | profiles: super_admin read all | SELECT | public | USING: is_super_admin() | CHECK: -
profiles | profiles: super_admin update all | UPDATE | public | USING: is_super_admin() | CHECK: -
student_tutors | st: admin all | ALL | public | USING: is_admin() | CHECK: -
student_tutors | st: parent read | SELECT | public | USING: (student_id IN ( SELECT s.id FROM students s WHERE (s.parent_id IN ( SELECT parents.id FROM parents WHERE (parents.user_id = auth.uid()))))) | CHECK: -
student_tutors | st: student read | SELECT | public | USING: (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = auth.uid()))) | CHECK: -
student_tutors | st: tutor read | SELECT | public | USING: (tutor_id IN ( SELECT tutors.id FROM tutors WHERE (tutors.user_id = auth.uid()))) | CHECK: -
student_tutors | student_tutors: admin_tutor insert | INSERT | public | USING: - | CHECK: is_admin_tutor()
student_tutors | student_tutors: admin_tutor read | SELECT | public | USING: is_admin_tutor() | CHECK: -
student_tutors | student_tutors: admin_tutor update | UPDATE | public | USING: is_admin_tutor() | CHECK: -
student_tutors | student_tutors: super_admin all | ALL | public | USING: is_super_admin() | CHECK: -
students | students: admin_tutor insert | INSERT | public | USING: - | CHECK: is_admin_tutor()
students | students: admin_tutor read | SELECT | public | USING: is_admin_tutor() | CHECK: -
students | students: admin_tutor update | UPDATE | public | USING: is_admin_tutor() | CHECK: -
students | students: own read | SELECT | public | USING: (user_id = auth.uid()) | CHECK: -
students | students: parent read | SELECT | public | USING: (EXISTS ( SELECT 1 FROM parents p WHERE ((p.id = students.parent_id) AND (p.user_id = auth.uid())))) | CHECK: -
students | students: super_admin all | ALL | public | USING: is_super_admin() | CHECK: -
tutors | tutors: admin_tutor insert | INSERT | public | USING: - | CHECK: is_admin_tutor()
tutors | tutors: admin_tutor read | SELECT | public | USING: is_admin_tutor() | CHECK: -
tutors | tutors: admin_tutor update | UPDATE | public | USING: is_admin_tutor() | CHECK: -
tutors | tutors: own read | SELECT | public | USING: (user_id = auth.uid()) | CHECK: -
tutors | tutors: super_admin all | ALL | public | USING: is_super_admin() | CHECK: -
tutors | tutors_admin_all | ALL | public | USING: is_admin() | CHECK: -
tutors | tutors_own_read | SELECT | public | USING: (user_id = auth.uid()) | CHECK: -
tutors | tutors_own_update | UPDATE | public | USING: (user_id = auth.uid()) | CHECK: -
```

## Functions (schema public). All but set_updated_at are SECURITY DEFINER with search_path=public, and all are executable by anon and authenticated.

```sql
-- is_admin() and is_staff(): identical
select coalesce((select role in ('super_admin','admin_tutor') from public.profiles where id = auth.uid()), false);
-- is_super_admin()
select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
-- is_admin_tutor()
select coalesce((select role = 'admin_tutor' from public.profiles where id = auth.uid()), false);
-- can_manage_academic(), can_manage_payments(): both just  select public.is_staff();
-- get_my_role()
select role from public.profiles where id = auth.uid();
-- set_updated_at() trigger (not definer): new.updated_at = now(); return new;
```

```sql
-- handle_new_user() trigger on auth.users
v_role := CASE WHEN new.raw_user_meta_data->>'role' IN ('tutor','parent','student')
               THEN new.raw_user_meta_data->>'role' ELSE 'student' END;
v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', new.email);
INSERT INTO public.profiles (id, full_name, email, role) VALUES (new.id, v_full_name, new.email, v_role) ON CONFLICT (id) DO NOTHING;
-- then inserts an 'Active' row in students / tutors / parents for that role (gen_random_uuid(), user_id = new.id, full_name, email)
```

```sql
-- record_payment(p_invoice_id uuid, p_parent_id uuid, p_student_id uuid, p_tutor_id uuid, p_amount_qar numeric,
--                p_method text, p_reference text, p_notes text, p_actor_user_id uuid, p_actor_role text) RETURNS jsonb
-- 1. if not public.is_staff() -> {success:false, error:'Unauthorized'}
-- 2. select invoice FOR UPDATE; not found -> error; status 'Voided' -> error
-- 3. insert payments (invoice_id, parent_id, student_id, tutor_id, amount_qar, method, reference, notes, status='Recorded', paid_at=now())
-- 4. v_new_paid := sum(amount_qar) of 'Recorded' payments on the invoice
-- 5. status := 'Paid' if v_new_paid >= total_qar, 'Partially Paid' if > 0, else unchanged
-- 6. update invoices set paid_qar, status, updated_at
-- 7. insert audit_logs (actor_user_id = p_actor_user_id, actor_role = p_actor_role, action 'record_payment', ...)
-- returns {success, payment_id, new_paid, new_status}
```

## What the export shows (Claude Code's reading; verify each point)

1. **Anyone can sign up as a tutor (verified from the function text).** handle_new_user accepts role 'tutor' from signup metadata and creates an Active tutors row. Because "classes/homework/class_notes/materials: tutor all" only check tutor_id = the caller's own tutor record, a self-registered tutor can insert classes, homework, notes and materials pointing at **any student_id**. Parents and students then see those rows. Fix: allow only 'parent' or 'student' at signup (or 'student' only), have staff create tutors, and add WITH CHECK requiring an active student_tutors link for tutor writes. Fawaz decides who may self-register.
2. **Old is_admin() ALL policies override the granular admin_tutor model (verified).** `assess: admin all`, `notes: admin all`, `parents_admin_all`, `st: admin all` and `tutors_admin_all` give admin_tutor full ALL, **including DELETE**, on assessment_requests, class_notes, parents, student_tutors and tutors. The granular admin_tutor rules don't include delete. This is the "Tutor Admin cancellation/correction" decision. Recommend dropping these five, then giving admin_tutor exactly what Fawaz approves.
3. **Old record_payment (verified).** is_staff() blocks non-staff, so it isn't an open hole. But the audit log stores caller-supplied p_actor_user_id and p_actor_role, so the audit trail can be forged by staff. Drop it once the app uses the new function, or log auth.uid() and get_my_role().
4. **admin_tutor profile update check is broken (verified).** `profiles_1.id = profiles_1.id` compares the subquery row with itself, so it matches every row. With 8 profiles holding different roles, the scalar subquery fails ("more than one row"). In practice admin_tutor profile updates likely **error out** rather than escalate (inferred, not tested). Replace it with a trigger or a security-definer RPC that keeps role and status unchanged unless the caller is super_admin.
5. **Duplicates:** parents and tutors each have two own-read/update policies, is_admin() = is_staff(), and can_manage_* = is_staff(). These are cleanup only.
6. **Payments:** admin_tutor can insert and read payments but not update or delete them, so only super_admin can correct a payment. Invoices: admin_tutor can't delete. Confirm with Fawaz that this is intended.
7. **Public data:** `assess: public insert` with CHECK true lets anyone, including anon, insert assessment requests. That's presumably the public form, but add a rate limit or captcha before launch. Every parent and student can read materials where is_public = true.
8. **Grants:** every function is executable by anon. That's harmless for the role helpers, which return false for anon, but revoke anon on record_payment.
9. **Private fields:** RLS is row-level only. Any column on a row a user can read is visible. For example, parents read whole students rows and admin_tutor reads every profile column. Protecting private fields needs column-limited views or RPCs, or column grants. List the columns you think are private and Fawaz will confirm.

## Fawaz's decisions (10 Nov 2026)

1. **Signup:** only parents and students may self-register. Tutors, admin tutors and super admins are created by staff. Change handle_new_user so 'tutor' from metadata becomes 'student' (or is rejected).
2. **Super admin:** Fawaz only, for now. Only super_admin may delete records, cancel or void invoices, and correct payments. Production has 2 super_admin accounts. Fawaz will confirm both are his; do not change them.
3. **Admin tutor is a scoped role, not a global one.** Admin tutors are selected people, for example the head of a firm with tutors under them. An admin tutor should manage **only their own group**: the tutors under them, those tutors' students and parents, and the classes, homework, notes, materials, invoices and payments linked to them. They should not see or change other groups' data, and not all tutors are admin tutors.
   - Today every admin_tutor rule is global (`is_admin_tutor()` with no row filter), so an admin tutor can read every profile, student, parent, invoice and payment. That must change.
   - This needs a data-model addition that production doesn't have. For example, a `tutor_groups` table (id, name, admin_user_id) plus `tutors.group_id`, with student and parent membership derived through student_tutors (or a direct `students.group_id`). Propose the simplest model and explain the options in plain English before writing migrations.
   - Remove admin_tutor DELETE everywhere, including the five old is_admin() ALL policies.
   - Until scoping exists, the safest interim step is to keep admin_tutor read-only outside their own data, or to give no one the admin_tutor role. Production has 1 admin_tutor account; ask Fawaz whether that person should keep global access in the meantime.

### Admin tutor model, chosen by Fawaz (10 Nov 2026)
- **Firms.** Add a firm (group) entity: name plus one or more heads, who are admin_tutor users. Each tutor belongs to exactly one firm. An admin tutor manages only their firm's tutors.
- **Students and parents follow their tutors.** An admin tutor sees a student, and that student's parent, when any of the student's tutors (via student_tutors) is in their firm. The same applies to classes, homework, notes, materials, invoices and payments linked to those tutors or students.
- **No deletes, voids or payment corrections for admin tutors.** Those stay with super_admin.
- **Interim:** Fawaz is downgrading the single current admin_tutor account to 'tutor' until firms exist. Both super_admin accounts are Fawaz's.
- Use a security-definer helper such as `is_firm_admin_for_tutor(tutor_id)` and `is_firm_admin_for_student(student_id)` so policies stay readable. Test that a firm head cannot see another firm's rows.

Please rebuild the fixture from this export, add tests for the decisions above (a self-registered tutor becomes a student; an admin tutor cannot read or change another group's rows; only super_admin can delete or correct payments), re-run the tests, and send Fawaz a plan before changing anything. Keep PR #2 as a draft.
