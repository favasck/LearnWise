# LearnWise UX/UI implementation

Status: local release candidate. Existing booking, calendar, automatic-parent and QA-checklist work in this checkout is preserved. This document does not establish production deployment or production database readiness.

## Implemented experience

1. **Daily priorities:** all four role dashboards put a useful next action before aggregate statistics. Students, tutors and administrators have a next-lesson panel with Qatar times and a validated HTTPS meeting link. Tutors can move directly to feedback or marking; administrators can reach enquiries, lessons and billing.
2. **Navigation and records:** navigation groups cover Start here, Learning, Finance & reports, and Administration & account. Existing route keys and role boundaries are retained. Student records have section links, an accessible return action, and explicit family-invoice context. Section titles and browser titles describe the current destination.
3. **Family context:** family totals appear once, separate from individual child profiles. A child selection follows parents through overview, children, lessons, homework and feedback while the authenticated portal is mounted. The provider is keyed to account/role ownership and resets when that identity changes. Billing intentionally remains the family account. A removed selection resets when an updated nonempty child list arrives.
4. **Lessons:** students and parents use responsive lesson rows/cards and a shared detail dialog. Details show actual status, topic, tutor, duration, attendance, location and preparation. Cancelled lessons do not offer a meeting action. Tutor attendance editing remains in its existing operational screen. The master calendar defaults to agenda on narrow screens; month and agenda remain available.
5. **Homework and progress:** dashboard tasks are ordered by due date, undated tasks last. Existing status filters use native buttons. Progress explains that tutor observations and activity counts are not exam grades or measured mastery. Homework submission, marking evidence and protected uploads are not invented by this presentation release.
6. **Billing:** parent billing fails visibly if either invoices or payment history cannot load; it does not present successful zero totals. Native buttons switch history views. Invoice details show the learner, recorded period, status, due date, billed/paid/balance amounts and notes. Currency displays two decimal places; this is a presentation change, not an accounting or transaction-atomicity repair.
7. **Visual system and accessibility:** action panels, next-lesson panels, family selectors, lesson lists and invoice dialogs extend the cream/teal identity. Tablet/mobile layouts, touch targets, focus behavior, readable form sizing, status announcements and mobile toasts are covered by shared components/styles. Native browser focus trapping and contrast/layout still require visual verification.
8. **Public journey:** the main navigation and document title say “Request an assessment.” Parent FAQs explain request versus confirmation, curriculum uncertainty, lesson format, portal access and discussing fees/policies. No new testimonials, credentials, cancellation promises or response-time promises were fabricated.
9. **Context recovery:** lesson/homework/enquiry display filters and invoice/payment tabs are stored in the current URL, survive refresh, and respond to browser history. Form drafts and credentials are not stored there. This does not preserve every calendar filter or every roster search across navigation.
10. **Regression coverage:** role actions, family totals, sibling filtering across pages, Qatar midnight boundaries, lesson links/details, invoice dialog, payment failures, task ordering and URL preferences have behavioral tests. Public render fixtures use the revised assessment label.

## Component reference

| Component | Purpose | States |
|---|---|---|
| DashboardActions | One primary next action and supporting destinations | Real counts or descriptive fallback |
| NextLesson | Earliest ongoing/upcoming scheduled lesson from returned records | Scheduled, no upcoming lesson, absent/invalid meeting URL |
| FamilySelector | Narrow learning records to one linked child | All children, one child, hidden for fewer than two active children |
| LessonList | Responsive read-only lesson browse and details | Scheduled, completed, cancelled, missing details/link |
| InvoiceDetails | Explain a persisted invoice | Partial payment, missing optional fields, notes |
| Shared loading/error/empty states | Explain service state | Loading, retryable error, genuinely empty result |

## Verification and remaining release gates

Run `npm test`, `npm run build`, `npm run test:render`, and `git diff --check` from the checkout. Tests use fixtures; they do not establish production email, role authorization, accounting integrity or visual layout.

Browser discovery reported “The browser access host is unavailable.” Native Chrome inspection then reached an app approval timeout. No fresh screenshot, pixel inspection, mobile-device review or native-browser accessibility result is claimed.

### Work that remains before the grand roadmap is complete

| Priority | Remaining outcome | Required evidence/dependency |
|---|---|---|
| P0 | Native desktop/tablet/360px review and keyboard/screen-reader walkthrough | Working browser access; screenshots and observed task outcomes |
| P0 | Verify operational data and permission contracts in staging | Current backend inventory and approved staging environment; existing readiness checklist |
| P1 | Reliable recurrence, exceptions, cancellation/make-up rules | Agreed business policies and transactional scheduling support; UI must reflect confirmed behavior |
| P1 | Correct payment posting, corrections and lesson/package charge linkage | Atomic/idempotent financial operations and accounting rules; display precision alone is insufficient |
| P1 | Complete curriculum, protected resource files and student submissions | Authorized data model, scoped storage/permissions and real submission/marking workflows |
| P1 | Evidence-based academic progress | Real assessment attempts, objectives and documented mastery calculation |
| P2 | User-tested mobile navigation and wider context persistence | Observe actual parent/student tasks before choosing bottom navigation; persist calendar/roster filters deliberately |
| P2 | Verified tutor profiles and authentic social proof | Owner-verified content and consent |
| P2 | Production rollout | Passing checks, completed release review and production deployment authorization |

## Measurement protocol

No conversion uplift or usability improvement percentage is claimed without a baseline. Record elapsed time, completion without help, errors and participant comments for these tasks:

- New parent: find suitable subject support and submit an assessment request; distinguish request from confirmed appointment.
- Student: find the next lesson, open its details and identify the earliest homework task.
- Parent with siblings: select one child, inspect lessons/homework/feedback, then identify the family balance and a specific invoice.
- Tutor: find the next learner, record attendance and publish shared feedback.
- Administrator: process an enquiry, inspect a student record and investigate a balance.

Collect a small representative baseline and repeat the same tasks after the candidate is available. Report medians and observed failure causes; choose numerical targets afterward. If analytics is introduced, define aggregate events for assessment step completion/failure, dashboard destination, lesson detail opening and invoice detail opening. Do not include names, contact data, free text, financial amounts, meeting URLs or record IDs in analytics payloads. No external analytics SDK or live telemetry was enabled by this change.

## UX/UI release candidate verification

- Full suite: 181 tests passed, 0 failed.
- Production build: passed.
- Built-artifact render: all 7 public pages and sign-in passed; no reported runtime errors.
- `git diff --check`: passed (Git reports the checkout's existing LF/CRLF normalization warnings).
- Visual review: browser access host unavailable; native Chrome app approval timed out. No screenshots or native/mobile visual approval obtained.
- Production deployment: not performed.

## Mobile implementation follow-up

The mobile prototype patterns have now been applied to the working portal. MOBILE-IMPLEMENTATION.md supersedes the earlier lesson-dialog, child-selection-refresh, parent-home, homework-table and mobile-navigation descriptions above. The local release is verified by 203 repository tests and a final 40-test affected-journey run. Native-device, participant and production rollout gates remain explicit.
