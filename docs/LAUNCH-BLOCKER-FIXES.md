# Launch blocker fixes — 9 November 2026

This branch includes PR #1's additive schema repair and adds database privacy and billing controls. It is a release candidate, not evidence of production migration. Supabase and Vercel plugins remain unconnected in this session.

## Resulting behavior

- Missing note/date-of-birth columns are added by the existing reconciliation migration. Profile hardening retains its protected, audited role/status RPC. No account is promoted or remapped.
- Canonical active-role/assignment policies replace legacy policies on the 13 application tables. This removes permissive policies instead of combining new restrictive rules with old permissive rules. The migration preserves application records.
- Six read-only `portal_*` views explicitly authorize rows and mask private columns. Internal notes are admin-only. Parent address/contact fields are available to the parent and admin; student contact/date-of-birth fields are available to that student, their parent and admin. Other users see nulls. Tutor contact/rate fields are available to that tutor and admin. Class billing fields are admin-only.
- Corresponding base-table SELECT privileges exclude private columns, so direct API calls and explicit column selection cannot bypass masks. Unknown columns on these tables abort the migration for disclosure review. Service reads and embedded relationships use the views; writes target base tables and return IDs, followed by the existing UI reload.
- `record_payment` serializes retries by request UUID, locks the invoice, validates the parent/student relationship and outstanding amount, and records payment, balance/status and a server-authored audit event in one transaction. Audit failure rolls back the entire operation. Posted payments cannot be edited/deleted, including through cascading parent/student deletion.
- `create_invoice` generates a unique number in PostgreSQL, calculates subtotal minus discount using numeric decimals, and supports retry identity. New invoices cannot claim to be Paid. The client cannot directly create payments/invoices or alter ledger amounts. Only supported issue/cancel transitions are granted. Corrections/refunds remain a separate future workflow.
- Billing retry UUIDs survive page reloads in local browser storage, scoped by account, operation and payload digest. No contact/payment payload is stored there. An uncertain retry with identical details uses the original UUID. Deliberately starting a new or changed payment is a new request; this does not deduplicate all possible manually entered duplicate receipts.
- Admin role selectors offer the implemented `admin`, `tutor`, `parent`, and `student` values.

## Production release order

1. Connect Supabase and Vercel. Confirm the intended project is `jllisbpzphxhbqqdpvtz`. Review `scripts/production-schema-report.sql` and `scripts/launch-ledger-report.sql`, including policies, grants, inherited roles and exposed security-definer functions. Verify a recoverable backup. No automatic financial data repair or account mapping is authorized by these files.
2. Rehearse against a separate database restored from the production schema. Test the actual PostgREST API and role accounts. PGlite does not establish Supabase/PostgREST compatibility or real concurrent-session behavior.
3. During a controlled maintenance window, apply the following once, in this order. If a migration is already recorded as applied, verify its objects rather than blindly rerunning it:
   1. `202611030001_protect_profile_updates.sql`
   2. `202611090001_reconcile_production_schema.sql`
   3. `202611090002_portal_privacy.sql`
   4. `202611090003_atomic_billing.sql`
4. Deploy the matching frontend immediately after the database changes, then verify each role and resume portal access. Privacy grants intentionally make the older frontend's wildcard base-table reads fail; do not leave old frontend and new database serving portal traffic together. Public pages remain independent of the account service.
5. Verify note creation with and without a linked class, linked-account bootstrap, nested student/parent/tutor/class/invoice queries, parent/student field masks, assignment removal, suspension, invoice issuance, partial/final payments, repeated UUIDs and two-session concurrent payment attempts. Test email confirmation/login/logout and public contact/assessment persistence separately.

Do not run the empty-database bootstrap on this existing production project. Its broad grants would undo later privacy/billing restrictions. The privacy migration also resets canonical grants, so do not replay it after atomic billing. The billing migration intentionally aborts for inconsistent historical balances, mismatched payment relationships, nonpositive historical payments or duplicate invoice numbers. Review historical records before deciding a correction; no old record is silently edited.

Rollback must keep the database protections: redeploy only a compatible frontend. Do not restore broad grants to make an old frontend work. In a failed release, keep account operations in maintenance while repairing forward; use the verified backup only through a reviewed recovery plan.

## Validation in this session

- `npm test`: 111 passed, 0 failed. Includes the pre-existing schema/security/auth checks plus PostgreSQL privacy/ledger tests, audit-failure rollback, invalid amounts/relationships, posting retries, denied escalation, suspension/revocation and real Supabase-client request construction.
- Production build: passed, 1550 modules; 376.21 kB JavaScript / 95.32 kB gzip for the initial candidate. The normal Vite configuration loader encountered a local parent-directory permission error; the equivalent programmatic build with `configFile:false` and the same React plugin passed. Remote CI must verify the standard build.
- `npm run test:render`: seven public pages and sign-in form rendered, no runtime errors, no backend calls. `git diff --check`: passed.
- No production migrations, real financial transactions, account changes or deployment changes were made. Authenticated live portal and real concurrent-session verification remain required.

The protected view relationship strategy follows [PostgREST's documented view embedding](https://docs.postgrest.org/en/v14/references/api/resource_embedding.html#foreign-key-joins-on-views). Schema-cache reloads are included. Actual deployed API relationship inference remains a release check.
