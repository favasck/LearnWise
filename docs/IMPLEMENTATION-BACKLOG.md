# Implementation backlog

Statuses distinguish local candidates from deployed/verified work. No migration has been applied externally.

| Order | Priority | Work | Acceptance / dependency | State |
|---|---|---|---|---|
| 1 | P0 | Current-state audit | Latest source references; separate production unknowns | Written |
| 2 | P0 | Profile escalation repair | Direct authenticated-role attacks denied; legitimate edits work; atomic permission audit | Local candidate, 29 tests pass |
| 3 | P0 | Production drift inventory and role decision | Read-only policy/grant/function/role export; intended legacy ownership mapping | Staging checker prepared; awaiting Supabase/Vercel connections, approved staging project and legacy ownership evidence |
| 4 | P0 | Canonical role/RLS repair | Separate superadmin/staff capabilities; field limits, assignment isolation, suspension/revocation, eliminate recursion | Pending #3 |
| 5 | P0 | Reliable audit foundation | Minimal server-authored events, required reasons, immutable records, atomic financial/permission mutations | Permission subset only |
| 6 | P0 | Auth lifecycle/routing | No stale account/profile state; login/logout/refresh tests; fail-closed role handling | Local controller/lookup repairs; 14 unit tests pass. Browser/API validation pending. |
| 7 | P0 | Financial/student data protection | Atomic idempotent payments, consistent relationships, restricted columns and deletion | Pending |
| 8 | P0 | Migration/bootstrap and CI | Clean and upgrade replay; DB/API tests; dependency advisory triage | Remote CI passes through c566403; staging metadata checker added; bootstrap defects and dependency findings remain |
| 9 | P1 | Existing intake/management repairs | Contact errors, anonymous submission, enum/nullability contracts, persistent settings | Pending |
| 10 | P1 | Scheduling/attendance | Qatar time, availability, conflicts, recurrence/occurrence exceptions, calendar views and cancellation rules | Pending business policy definition |
| 11 | P1 | Tuition billing completion | Rate/package models, invoice linkage, refunds/credits/corrections, rounding and concurrency tests | Pending #7 and fee policies |
| 12 | P1 | Portal completeness/refactor | Error propagation, responsive/browser coverage, safe extraction and service consolidation | Pending |
| 13 | P2 | Edexcel curriculum and resources | Versioned syllabus hierarchy, rights metadata, secure uploads and protected downloads | Pending |
| 14 | P2 | Academic progress | Homework submissions, diagnostics, marking, quizzes/exams and evidence-based mastery | Pending #13 |
| 15 | P3 | Communications | Opt-in outbox, sandbox adapters, approved templates/delivery state | No live sends authorized |
| 16 | P3 | Independent tutors/marketplace | Tenant isolation, verification, separate commerce ledger | After operational tuition system |

Security-sensitive role mapping, destructive changes, production migration/deployment, paid activation and live messages/payments require explicit approval. Continue safe local implementation without per-edit approval.
