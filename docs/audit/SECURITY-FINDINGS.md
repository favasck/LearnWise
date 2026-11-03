# Security findings

See CURRENT-STATE.md for baseline evidence and the per-table operation matrix.

| Finding | State after batch 1 |
|---|---|
| SEC-001 profile escalation | Local candidate implemented and PostgreSQL tests pass. Not applied to Supabase. |
| SEC-002 role mismatch / Admin Tutor authority | Open. Requires actual role inventory and owner-approved legacy mapping. |
| SEC-003 suspension | Self-status updates blocked locally; privileged RPC rejects suspended actors. Existing other-table policies still allow suspended-account access. |
| SEC-004 broad updates | Open for classes, homework, tutors, parents. |
| SEC-005 academic assignment writes | Open; validate target student and class together. |
| SEC-006 audit gaps | Permission RPC has atomic minimal audit. Existing audit_logs UI/service and other mutations remain unresolved. |
| SEC-007 cyclic policies/revocation | Source dependency cycle confirmed; runtime reproduction of affected reads pending. |
| SEC-008 excessive columns | Open; define disclosure matrix before introducing safe views. |
| SEC-009 public assessment write | Open; public submission must not accept administrative fields. |
| AUTH-001 stale session/profile state | Local controller revision checks and cancelled/keyed linked lookups implemented in batch 2; 14 controller tests pass. Browser/Supabase runtime verification pending. |

## Batch 1 controls

Migration `202611030001_protect_profile_updates.sql` revokes UPDATE at both table and column level from PUBLIC, anon and authenticated, then permits only full_name/phone for authenticated. RLS remains enabled. Existing profile policies determine which rows can be edited. Privileged updates use `admin_update_profile`, which checks the current persisted actor role/status, rejects self-permission changes and accepts only role/status keys. Existing role constraints still apply. No account is mapped or promoted by the migration.

Permission events contain actor ID/role, target ID, timestamp and old/new role/status only. No names, email, tokens, passwords or student snapshots are logged. The event insert shares the permission-update transaction; failure rolls back the update. Ordinary API roles cannot insert, update or delete these events. The table intentionally differs from unverified `audit_logs`; integration with a broader audit model is follow-up work. There is no organization model in baseline; organization and reason/correlation fields are deferred to the agreed canonical authorization/audit model rather than populated with invented values.

## Limits and review requirements

This is a candidate migration for the known baseline. Inspect actual schema, memberships, grants, helper functions, exposed RPCs and audit objects before approval. Custom database roles inheriting other permissions are outside the baseline and need review. Database owner/service-role operations remain trusted. The legacy `admin` check is deliberately retained until ownership and permissions are verified; canonical staff roles are not enabled by this patch. No production security claim is made.
