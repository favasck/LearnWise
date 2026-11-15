# Release QA checklist

Version: 2026-11-15. Covers released changes and booking work whose availability must be verified per environment. This supersedes the older launch checklist's role/profile/billing feature-status notes; use docs/ROLE-PERMISSIONS.md for current permissions.

Record build/commit, environment URL, tester, date, browser/device, test roles and evidence. Use invented records in an approved test environment. Never run Create Test Data against production.

Every case starts Not Tested. Record Passed, Failed, Blocked or N/A with evidence or a reason. Basic system checks prove data access only, not authorization, persistence, email delivery or workflow readiness. Do not mark manual cases passed because CI or deployment passed.

The in-app QA System Test page offers the same checklist with result/evidence fields and a JSON download. Results are held only while the page is mounted; download before leaving or reloading.

## Authentication

- [ ] **AUTH-01** Sign up, confirm email, sign in/out, refresh and switch accounts. No previous account data or stuck loading remains.
- [ ] **AUTH-02** Verify reset-email delivery and a valid password reset; reject expired/reused links and mismatched passwords.
- [ ] **AUTH-03** Suspend an active account and interrupt the account service; access is denied and errors offer recovery.

## Roles and team access

- [ ] **ROLE-01** Super Admin changes another account between Tutor, Admin Tutor, Parent and Student. Linked records are reused/created and actions audited.
- [ ] **ROLE-02** Keep the affected account open during downgrade/suspension. Access refreshes without stale privileges.
- [ ] **ROLE-03** Assign a tutor team; check own-team records, automatic ownership on new records and denial of other teams through screens and direct requests.
- [ ] **ROLE-04** Unassigned Admin Tutor, tutor and family accounts cannot open global users/settings/QA routes or invoke privileged actions directly.

## Profiles

- [ ] **PROFILE-01** Every role saves name/phone, reloads and sees synchronized linked records. Email, role and status remain protected.
- [ ] **PROFILE-02** Unlinked users can open settings; tutor teaching details load; failed saves retain edits and support retry.

## Students, parents and tutors

- [ ] **PEOPLE-01** Create/edit students, parents and tutors with valid/invalid inputs; saved fields and state survive reload.
- [ ] **PEOPLE-02** Add a parent by selecting one or several existing students without an actual name. Verify Parent of [names], grade, school and curriculum after reload.
- [ ] **PEOPLE-03** Add the actual name later and change selected children. Portal links update; deleted or already-linked students are not accidentally reassigned.
- [ ] **PEOPLE-04** Interrupt parent/student linking and retry. Successful links remain; failed links are explained; no duplicate parent is created.
- [ ] **PEOPLE-05** Link role accounts; assign and revoke tutors. Verify portal access and loss of unrelated access.

## Classes, calendar and attendance

- [ ] **CLASS-01** Create/edit/cancel a class with student, tutor, subject, duration, mode and link/location; verify permitted portals after reload.
- [ ] **CLASS-02** Calendar month changes, Qatar dates, start/end times and midnight boundaries work from a different device timezone; deleted classes stay absent.
- [ ] **CLASS-03** Tutor changes permitted attendance/status only; other tutors cannot view/edit the class; attendance persists in reports.

## Learning content and family portals

- [ ] **LEARN-01** Create/edit notes including areas to improve; test parent/student sharing independently and deny private notes.
- [ ] **LEARN-02** Create/edit/review homework with due dates/statuses; material links open and appear only to permitted learners.
- [ ] **LEARN-03** Sign in as two separate families/students. Dashboards, classes, homework, progress and permitted balances contain only their records.

## Billing and reports

- [ ] **BILL-01** Create/edit invoices; numbers remain unique and amounts/status/student/parent associations stay correct across teams.
- [ ] **BILL-02** Record/edit/retain-delete a test payment; invoice paid amount, balance and status recalculate after each operation and reload.
- [ ] **BILL-03** Reconcile reports, date filters, dashboard totals and parent balances against known test records; deleted payments do not count.
- [ ] **BILL-04** Try double clicks, interrupted saves and concurrent billing actions; no duplicate charges or partial totals. Record unresolved failures.

## Retained deletion and history

- [ ] **HISTORY-01** Delete test students/parents/classes/notes/homework/materials/invoices/payments; rows, relationships, actor and time remain, and editing is disabled.
- [ ] **HISTORY-02** Invoice/payment history shows create/edit/delete, before/after values and Qatar times. Unrelated users cannot read or alter history.

## Public pages and recovery

- [ ] **PUBLIC-01** Open all seven pages, subject assessment links, deep URLs, Back and refresh; unknown URLs offer recovery.
- [ ] **PUBLIC-02** Submit assessment/contact with invented details. Check required fields, assessment Back, preserved subject, retry and admin receipt.
- [ ] **PUBLIC-03** Block the account service. Public pages work; sign-in/submission errors offer recovery without exposing credentials.

## Mobile and accessibility

- [ ] **UI-01** Check phone/tablet/desktop menus, tables, calendar, forms and dialogs for clipping and usable actions.
- [ ] **UI-02** Check keyboard navigation, associated labels, focus indicators, dialog close/return focus and announced errors.

## Booking requests — confirm availability in this release

- [ ] **BOOK-01** Verify booking services are installed in the tested environment; otherwise record Blocked and the dependency.
- [ ] **BOOK-02** Publish/close tutor availability. Families see linked students, assigned tutors and published hours only, with correct Qatar times and locations.
- [ ] **BOOK-03** Submit preferred times; no class exists until confirmation. Tutor alternatives require family acceptance; acceptance creates exactly one calendar class.
- [ ] **BOOK-04** Test overlaps, travel buffers, same-location adjacency, closed windows and revoked assignments; stale/repeated replies cannot duplicate classes.
- [ ] **BOOK-05** Check history, decline/cancellation, failed-save retry and family/tutor status updates. Unrelated/suspended users cannot read or act.

## Release verification

- [ ] **RELEASE-01** Record source build/commit, environment, tester and date. Run automated tests, production build and artifact render against that exact source.
- [ ] **RELEASE-02** Verify deployment and live public/sign-in rendering; complete authenticated workflows separately and attach evidence/blockers before sign-off.
