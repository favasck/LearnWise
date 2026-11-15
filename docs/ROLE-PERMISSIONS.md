# Role permissions

Current rules agreed on 15 November 2026. These supersede the previous global Admin Tutor rules.

| Role | Scope and capabilities |
|---|---|
| Super Admin | All records; account role/status changes; explicit tutor-team assignments. Role changes are audited and automatically refresh the affected account. |
| Admin Tutor | Own work, people and explicitly assigned tutors. Add/edit/retained-delete students, parents, classes, materials, payments, invoices, homework and class notes inside that scope. No global role/settings access. |
| Tutor | Own tutor record, assigned students and their parents, own classes and academic content. Cannot see another tutor or their people. Class changes are limited to attendance/status. |
| Parent | Linked children and permitted academic/financial information. |
| Student | Own permitted academic information. |

Every role has personal Profile Settings. Self-service edits are restricted to name and phone; email, role and account status are read-only. Personal changes synchronize to linked role records.

Tutors are assigned to one Admin Tutor using Tutors > Edit > Admin Tutor team (Super Admin). Newly created tutors under an Admin Tutor are assigned to that account automatically. No existing tutor is assigned implicitly. Switching an account to Tutor/Parent/Student/Admin Tutor reuses or creates the appropriate linked record. Role downgrades revoke team access at the database immediately; the browser receives realtime updates with focus/15-second fallback checks.

Deletion retains the original row, relationships, actor, timestamp and immutable before/after history. Deleted records are read-only; invoices and payments expose History. Payment edits/deletions recalculate invoice totals transactionally. Unknown legacy invoice ownership remains Super Admin-only until assigned explicitly. Invoice numbers use a server sequence across teams.

Database changes are versioned by Supabase migrations. SQL sources: docs/sql/scoped_team_permissions.sql, then docs/sql/role_rpc_privileges.sql. The CLI was unavailable and npm access was restricted, so the connected Supabase migration tool applied the scripts. Do not replay the older bootstrap over this release: it contains superseded global policies.

Verification: tests/scoped-teams.test.js exercises real PostgreSQL RLS/trigger/RPC behavior; rendered tests cover personal settings, Qatar calendar times and retained history. Live rollback-only probes verify Hiba's role switching, scope isolation, invoice/payment CRUD and totals without retaining test data.
