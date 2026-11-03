# Database schema

Baseline SQL declares profiles, tutors, parents, students, student_tutors, classes, class_notes, homework, invoices, payments, materials and assessment_requests. Profiles reference auth.users; tutors/parents/students optionally link auth accounts. Students optionally link parents; student_tutors links teaching assignments. Classes reference one student/tutor. Academic records reference students/tutors/classes. Invoices/payments reference parents and optional student/tutor relationships. Materials use external URLs. All baseline tables enable RLS.

Important limitations: several deletes cascade through history; identity links are not unique; invoice number is not unique; financial consistency is not transactionally enforced; assignment reads have cyclic policy dependencies. Baseline uses legacy admin, not frontend staff roles. The setup script is not a reliable migration runner and has forward references/policy replay defects.

Candidate migration 202611030001 adds permission_audit_events (UUID ID, actor UUID/role, action, target UUID, minimal JSON changes, timestamptz), restricts profile UPDATE grants, and exposes admin_update_profile(uuid,jsonb). Audit events intentionally retain IDs independently of later profile deletion. Only current active legacy admins can read these events; owner-operated database retention remains a separate policy decision.

Existing Supabase instances may differ. Compare actual constraints, grants, functions and RLS before migration approval. No organization, recurring schedule, ledger or syllabus tables have been added yet.
