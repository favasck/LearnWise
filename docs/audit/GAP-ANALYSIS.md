# Gap analysis

The source-review findings in master prompt v3 remain applicable at baseline 154984c. See CURRENT-STATE.md for exact references.

| Capability | Existing | Missing or unverified |
|---|---|---|
| Authentication | Supabase signup/password login/session, role routing | Session-race tests, recovery, production Auth configuration verification |
| Permissions | Role config, RLS declarations | Canonical role reconciliation, field permissions, suspended-session revocation, full isolation tests |
| Audit | Browser helpers and audit screen | General schema, mutation integration, mandatory transactional logging; batch 1 adds permission-specific events only |
| Scheduling | One-off classes, by-day listing, attendance | Availability, daily/weekly/monthly calendars, recurrence, exceptions, overlap prevention |
| Billing | Manual invoices/payment records/reports | Atomic/idempotent ledger, refund/correction history, package consumption, fee policies, unique numbering |
| Resources | Tutor/admin URL materials | Syllabus hierarchy, upload validation, protected storage/downloads, licensing metadata |
| Learning | Homework CRUD and shared class notes | Student submission, diagnostic/quiz/exam engine, rubrics, evidence-backed mastery |
| Communication | Public contact/inquiry UI | Reliable intake, opt-in outbox, notification delivery, approved WhatsApp integration |
| Marketplace | None verified | Independent tutor tenancy/verification, subscriptions, separate commerce ledger |
| Quality | In-app admin QA reads and fixture writes | Role-based browser/API suite, CI, clean-bootstrap migrations; batch 1 adds isolated DB tests |

No feature is considered operational merely because its component exists. Persistence, authorization, responsive behavior and end-to-end workflows remain to be verified in an approved nonproduction environment.
