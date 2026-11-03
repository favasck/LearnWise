# Current-state assessment

Read-only source assessment completed 2026-11-03 before application edits. Baseline: `154984c` (`main`, tracking `origin/main`); initial working tree clean. Repair branch: `security/p0-profile-escalation`. No AGENTS.md was found in the working tree. No production queries, mutations, messages, payments, or deployments were performed.

## Evidence and limits

The latest local source is authoritative. DELIVERY.md is a historical claim, not verification. The November master specification supplies the earlier review findings; all ten listed findings remain applicable in this checkout. Production schema, grants, policies, Auth configuration, account ownership, storage and deployed code are unknown. No credentials or environment files are supplied. Source-level findings below do not prove the same schema is deployed.

## Architecture and inventory

React 18 SPA, Vite 5, Lucide icons, Supabase JS (lockfile: 2.108.2), Supabase Auth and direct PostgREST queries. `src/main.jsx:6` wraps App with AuthProvider. `src/App.jsx:3838` controls navigation using component state; there is no router or application server. Vercel rewrites all paths to index.html. `src/services/supabaseData.js:27` wraps queries. Direct Supabase calls also exist in App and AuthContext. `src/supabaseData.js:17` duplicates the service with an invalid parent-relative client import; it is not imported by the entry graph.

| Area | Source entry points | Assessment |
|---|---|---|
| Public site | App.jsx:176–785 | Home, About, Subjects, IGCSE, Online, Assessment, Contact exist. Contact fails schema validation but reports success; assessment has INSERT/SELECT and mode mismatch defects. |
| Admin accounts | App.jsx:827 | Load/filter users, change roles/status, link records exist. No mutation audit calls; insufficient Admin Tutor authorization. |
| Student/parent/tutor administration | App.jsx:990, 1032, 1081, 1126 | CRUD, search, linking and tutor assignments exist. Hard deletes cascade into academic and financial history; restricted-role checks are absent from delete handlers. |
| Scheduling and attendance | App.jsx:1176, 1236, 2533 | One-off classes, list/by-day views, cancel/edit/delete and attendance exist. No recurrence, availability, transactional overlap protection or occurrence exceptions. |
| Academic administration | App.jsx:1257, 1296, 1345 | Homework, class notes and URL materials CRUD exist. No secure file upload workflow. |
| Billing | App.jsx:1387; services/supabaseData.js:547–679 | Invoices, issue action, payment recording and reporting exist. Payment and invoice updates are non-atomic. No verified refund/package ledger or gateway. |
| Assessments/reports | App.jsx:1452, 1488 | Inquiry status handling and aggregate reports/print exist; no academic examination engine. |
| Audit/settings/QA | App.jsx:1717, 1785, 1798 | Audit read UI references missing schema; settings Save has no handler. QA uses broad admin reads, not isolation tests; its test-data action writes despite read-only labels. |
| Tutor | App.jsx:2375, 2453, 2533, 2599, 2744, 2883 | Dashboard, assigned students, classes/attendance, note/homework/material CRUD exist. Review writes generic feedback. Note class is optional in UI but mandatory in SQL. |
| Parent | App.jsx:3029, 3093, 3142, 3206, 3267, 3327 | Child, class, homework, progress and financial views exist. Several parallel fetches discard errors; no end-to-end persistence verification. |
| Student | App.jsx:3425, 3501, 3557, 3619, 3684 | Classes, homework, materials and shared notes are read views. No homework submission UI despite service support. No mastery/quiz/exam functionality. |

## Confirmed security and functional findings

Line references are to baseline commit 154984c.

| ID | Severity | Evidence/functions | Consequence | Proposed repair and verification |
|---|---|---|---|---|
| SEC-001 | P0 | supabase_setup.sql:104 own UPDATE; :48 is_admin | An authenticated user can set their role to admin and gain all admin policies. Metadata sanitization in handle_new_user does not protect later UPDATEs. | DB-enforced self-service field allowlist and explicit privileged operation; execute direct SQL under authenticated role and attempt every elevated role. |
| SEC-002 | P1 | SQL:75 constraint, :48 helper; roles.js:16; App:850, :3911 | Canonical staff roles rejected/unrecognized by SQL; Admin Tutor shares unguarded admin mutation screens. | Inspect actual role values and intended owners before role mapping. Separate superadmin/staff capabilities in DB and UI. Test full action matrix. |
| SEC-003 | P1 | SQL:104; App:3895 | Self-update can change suspension; policies do not revoke access for suspended accounts. | Protect status now; later apply account-active checks to all policies and test existing sessions after suspension. |
| SEC-004 | P1 | SQL:451 classes tutor UPDATE; :614 homework student UPDATE | Whole-row updates permit changing billing/scheduling fields or assignment/feedback fields. | DB field restrictions or narrow RPCs; verify forged payloads and legitimate attendance/submission. |
| SEC-005 | P1 | SQL:520, :593, :771 tutor FOR ALL | Tutor ownership alone does not validate student/class assignment on content writes. | Validate active assignment and matching class relationships transactionally; test unrelated IDs. |
| SEC-006 | P1 | App:13 only audit import; auditLog.js:55 logAction; App:1728; entire SQL | No audit_logs DDL, no application mutation audit calls, browser actor/snapshots trusted, failures suppressed. | Server-owned minimal audit events in same transaction as critical writes; immutable privileges and failure rollback tests. |
| SEC-007 | P1 | SQL:323, :361, :371; materials:782 | Cyclic RLS dependencies among students, tutors and student_tutors risk policy recursion. Inactive assignments still qualify in multiple read policies. | Reproduce with non-owner roles; replace cyclic predicates with scoped helpers and test access revocation. |
| SEC-008 | P1 | SQL:190, :199, :211, :309, :313, :323; services selects '*' | Whole records expose internal notes, tutor rates and student details to permitted readers beyond UI display. | Define field-level disclosure model and narrow grants/views; test raw API response columns. |
| SEC-009 | P1 | SQL:855 public INSERT with true | Public client controls status, admin_notes and timestamps; no abuse protection. | Narrow public submission operation and rate controls; reject protected fields without adding public read access. |
| FUN-001 | P1 | services/supabaseData.js:643 createPayment, :602 generateInvoiceNumber | Non-atomic balance update, ignored invoice errors, concurrent lost updates, number races and no unique invoice number constraint. | Transactional idempotent financial RPC/ledger with decimal arithmetic and concurrent tests. |
| FUN-002 | P1 | App:721 contact submit; SQL:822; service:753 | Missing required student_name; contact reports success on failure. INSERT returning row requires unavailable public SELECT. | Separate inquiry contract, no returned PII, explicit error handling; anonymous integration tests. |
| FUN-003 | P2 | App:683; SQL:829 | In-Person UI value violates Offline SQL check. | Canonical value mapping and integration test. |
| FUN-004 | P2 | App:1785, :3557, :2599, :2883; SQL:488, :745 | Nonpersistent settings, no student submission, optional class incompatible with notes schema, optional material URL incompatible with NOT NULL. | Repair contracts and workflows with component and DB tests. |
| FUN-005 | P2 | App:1178, :1183; service:44 | UTC date slicing mixed with local times; no scheduling conflict validation or recurrence. | Qatar timezone utilities and transactional scheduling model with exceptions. |
| FUN-006 | P2 | App:3142, :3206, :3267 | Query failures flatten into empty lists. | Standardize error propagation and failure tests. |
| AUTH-001 | P1 investigation | AuthContext.jsx:20, :78; App:3852 | Async profile fetch in auth callback and uncancelled requests can hang or restore stale profile/linked data after account transitions. Runtime reproduction pending. | Separate session notification from profile fetch; reject stale responses; test login/logout/account switching. |
| OPS-001 | P2 | package.json:6; DELIVERY.md:68; supabaseClient.js:6 | No test/lint/CI scripts, missing env example, createClient receives empty URL when unconfigured. | Document requirements, add test runner, validate configuration and build/runtime separately. |
| OPS-002 | P2 | SQL:100, :194, :199, :676 | Setup claims rerunnable but does not drop several policy names it creates. CREATE TABLE IF NOT EXISTS does not upgrade existing constraints. | Versioned migrations and clean/upgrade replay tests. |

Auth callback risk is consistent with [Supabase troubleshooting](https://supabase.com/kb/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0), but has not been reproduced here. RLS restricts rows, not allowed update columns; see [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

## RLS operation review (baseline)

All 12 tables enable RLS. No explicit table/column GRANT hardening is supplied. Table ownership/service roles bypass ordinary RLS; tests must impersonate authenticated roles.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | Own/admin | Signup trigger only; browser fallback lacks policy | Own whole row/admin: escalation | No policy |
| tutors | Own/admin/assigned student or parent | Admin | Own whole row/admin | Admin |
| parents | Own/admin | Admin | Own whole row/admin | Admin |
| students | Own/parent/assigned tutor/admin | Admin | Admin | Admin |
| student_tutors | Linked tutor/student/parent/admin | Admin | Admin | Admin |
| classes | Linked tutor/student/parent/admin | Admin | Linked tutor whole row/admin | Admin |
| class_notes | Tutor/admin; parent/student sharing flags | Tutor ID ownership/admin | Tutor ID ownership/admin | Tutor ID ownership/admin |
| homework | Linked student/parent, owning tutor/admin | Tutor ID ownership/admin | Student whole row/tutor/admin | Tutor/admin |
| invoices | Parent/admin (including drafts) | Admin | Admin | Admin |
| payments | Parent/admin | Admin | Admin | Admin |
| materials | Target student/parent or tutor-public relation; owner/admin | Tutor ID ownership/admin | Tutor ID ownership/admin | Tutor/admin |
| assessment_requests | Admin | Anyone, all columns | Admin | Admin |

## Build and production verification boundaries

Initial checkout has no node_modules, environment example, test harness, migration directory or CI. Node available: 24.18.0. Locked Vite: 5.4.21. Installation/build and vulnerability results are recorded in TEST-RESULTS as executed, not inferred from DELIVERY.md. Production verification requires a read-only schema/grant/function export, Auth settings and a redacted role inventory. Do not assign legacy accounts canonical elevated roles without an ownership decision. Isolated Postgres tests cannot replace eventual PostgREST and browser tests against an approved nonproduction Supabase project.
