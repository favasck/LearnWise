# Firm access and onboarding — tested draft

This is the current specification following Fawaz's subsequent decisions in this conversation. It supersedes the earlier fixed/global Tutor Admin proposal. Only `fix/launch-blockers` is changed. PR #2 remains draft; production, existing accounts and current signup behavior are untouched by this work.

## User behavior

- Super Admin creates firms and explicitly grants/revokes each user's firm role and selected powers. Both existing Super Admin accounts are preserved. No one is automatically promoted, assigned to a firm or demoted.
- An Admin has no powers merely because of a title. Every task is granted explicitly and applies only to that firm. The older stored `admin_tutor` profile value is displayed as **Admin** for compatibility; it does not grant global access through the new guards.
- A tutor can add a parent and student in their firm. Students added through that tutor's form are assigned to that tutor. Other tutors cannot be substituted. Managers can assign additional tutors through the existing assignment screens. A student/parent sees the corresponding assigned tutors, including multiple tutors.
- Parents/students may sign up. Tutor/staff metadata is sanitized to student in both client and database. Firm tutors are explicitly assigned by Super Admin. Existing self-registered tutors do not gain firm access automatically.
- Adding a record does not attach an account. An issuer creates a seven-day invitation to a specific confirmed email; the recipient signs up/signs in and accepts it. Tokens are stored hashed, single use, and bound to role, record and firm. Expired, consumed, wrong-email, wrong-role, cross-firm or revoked-issuer invitations fail. No email is sent automatically by this work; the issuer shares the link.
- The firm selector limits portal queries to the chosen firm. No firm services means no fallback to the old global Admin portal. Switching users/firms clears the prior selection and remounts portal state. Server authorization remains authoritative.

## Powers available for delegation

View roster, manage roster/assignments, manage tutors, manage academic work, view billing, create/issue invoices, record payments, void unpaid invoices, and correct payments. Academic/invoice forms also need roster visibility to populate their person selectors; grant that separately when required. There are no implicit global powers.

The latest decision permits an Admin to void/correct only when Super Admin explicitly grants those powers. Without them, even the firm's Admin is denied. Reasons are required for grants, revocations, voids and corrections. Direct amount/status changes cannot bypass the audited APIs. Permanent deletion remains Super Admin-only; issued invoice history is protected even against cascading deletion.

Corrections append an adjustment instead of changing/deleting the original payment. Invoice balances, payment lists and revenue queries use effective amounts. Parents see effective amounts for their own transactions; original values remain available for history. Voiding retains an unpaid invoice as Cancelled. It does not erase the invoice or its audit trail.

## Data model and enforcement

Each roster/operational record belongs to one firm, with nullable firm IDs only for pre-existing/unassigned records. One authentication account may have roster records in multiple firms. This avoids exposing one firm's student notes through another firm's roster record. Parent access follows linked children. A tutor can hold explicit memberships in multiple firms.

`firms` and `firm_memberships` store ownership, active membership and allowlisted permissions. `firm_invitations`, `payment_adjustments` and `firm_audit_events` are protected separately. Ordinary clients cannot change memberships, invitations, adjustments or audit history directly.

Restrictive policies AND with the exact exported permissive policies, so the older broad `is_admin()` policies cannot restore cross-firm access or Admin deletion. Unknown permissive policies also cannot bypass these guards. Active profile, membership, firm and tutor/assignment checks use persisted data rather than editable metadata. Revocation/suspension takes effect on the next request.

Composite foreign keys and validation triggers enforce same-firm relationships. Explicit SECURITY INVOKER computed relationships avoid ambiguous PostgREST embedding after adding composite keys. `payment_balances` is a SECURITY INVOKER view, so parent/billing visibility remains subject to RLS. Real PostgREST embedding must still be verified on a separate Supabase test database.

Authoritative audit events derive the actor from `auth.uid()`, retain before/after snapshots, and share the mutation's transaction. Audit failure rolls back roster creation, links, financial adjustments and balance updates. Only Super Admin can read the authoritative audit history; clients cannot rewrite it. The older audit screen remains historical; current firm events appear in Access & onboarding.

## Fixture provenance and verification

`tests/fixtures/production-export-20261110.md` preserves the supplied export. `exported-production-fixture.js` parses every policy and installs the supplied helper expressions, including the global legacy policies and broken scalar check. The already-removed metadata policy stays absent, and the already-added date-of-birth column is present. The signup/payment bodies were summarized in the export, so their baseline bodies are explicitly reconstructed from those descriptions. Full table DDL/grants were not exported; schema scaffolding and deliberately broad test grants are labelled. This is substantially stronger than the earlier guessed-policy fixture, but is not a byte-for-byte production database clone.

Tests cover two firms, both unchanged Super Admins, delegated Admin authority, cross-firm reads/writes and forged links, multiple tutors per student, tutor-created parents/students, signup sanitization, invitations and revoked issuers, public materials isolation, anonymous access, immutable audit/financial history, idempotency, server-derived actors, effective corrected balances and audit rollback. A protected-screen DOM test exercises firm selection and checks that Admin sees granted tasks but no Super Admin controls. HTTP construction tests use the real Supabase client with an injected transport.

## Release boundary

The new SQL lives under `sql/candidates/`, deliberately outside migration discovery. The old blanket privacy migration remains withdrawn and must not run. Do not apply all files in `migrations/` or merge this frontend against the old database.

Before any future rollout: review complete live DDL/grants/triggers, verify the candidate on an isolated Supabase database with real REST/auth/concurrent sessions, run advisors, and explicitly map each existing record/assignment to a firm. Unassigned historical records are not silently assigned; non-Super users cannot read them through these guards. Determine an owner-approved mapping before changing live access. Generate final migrations with the Supabase CLI only after that review.

Private-field disclosure within an otherwise authorized row still needs the owner's column-level disclosure decisions. This draft prevents cross-firm access but does not claim that all existing shared-row columns are appropriately private. Other previously documented product gaps remain out of scope. No production query, attack, migration, account mapping, live message or manual deployment was performed.
