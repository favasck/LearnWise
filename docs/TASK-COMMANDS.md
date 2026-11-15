# LearnWise task commands

Expanded command workspace, 16 November 2026. Typed tasks prepare existing LearnWise operations; they do not change account permissions. This release requires no database migration.

## Supported tasks

| Area | Commands and behavior |
|---|---|
| Students | Add, find, edit and retained-delete; edit grade, school, curriculum, subjects, parent and learning goals |
| Parents | Add, find, edit and retained-delete; name, email, phone, address and notes |
| Tutors | Add, find, edit and retained-delete within existing staff scope |
| Family relationships | `Link parent Fatima to Naila` changes the family link with acknowledgement |
| Tutor assignments | `Assign tutor Amal to Naila, subject: Maths`; `Unlink tutor Amal from Naila`; list assignments |
| Classes | Staff create, edit/reschedule and retained-delete; authorized tutors/staff cancel or complete an existing class |
| Attendance | `Mark Naila present today`; present, absent, pending or cancelled; always selects an exact lesson |
| Homework | Add, find, edit, retained-delete and review a submitted assignment with actual feedback |
| Materials | Add, find, edit and retained-delete resource links, with explicit student/sharing choices |
| Lesson notes | Add, find, edit and retained-delete linked class feedback; explicit parent/student sharing; no invented understanding rating |
| Student exams | Add, find, edit and remove exam dates using existing booking/exam services |
| Availability | Publish a dated window, list future windows, close a window; mode and travel-buffer fields |
| Booking requests | Find, confirm, decline with a reason, propose updated time/duration/mode/location; retain recurrence and expected version |
| Assessment enquiries | Staff find requests and edit enquiry status/internal notes |
| Calendar | Add private/shared all-day or timed entries, find combined calendar records, edit/remove authored entries and mark calendar tasks done |
| Reports | Attendance, progress observations, homework, revenue, outstanding invoices and tutor performance, with existing access restrictions |

Examples:

- `Add student Naila, Year 8, maths`
- `Add parent Fatima, phone: 55512345`
- `Add class for Naila tomorrow at 5 PM, subject: Maths`
- `Edit class timing for Naila, date: 2026-11-20, time: 17:00`
- `Add homework Fractions for Naila, due: tomorrow`
- `Review homework Fractions for Naila, feedback: Clear working`
- `Add material Fractions worksheet for Naila, link: https://example.com/worksheet`
- `Add note for Naila, topic: Fractions`
- `Show pending requests`
- `Confirm request for Naila`
- `Decline request for Naila, reason: Unavailable`
- `Attendance report for Naila, from: 2026-11-01, to: 2026-11-30`
- `Add calendar event Parent meeting tomorrow`
- `Delete calendar event Parent meeting`
- `Add exam Maths for Naila tomorrow at 9 AM`
- `Add availability, start: 2026-11-20T14:00, end: 2026-11-20T19:00`

Short commands may omit details: the task card asks for required information. Labels such as subject, due, date, time, phone and feedback can prefill details. One task is handled at a time. Unsupported clauses are rejected rather than silently discarded. Ambiguous names require a selection; absolute dates/times appear before saving. All academy dates use Asia/Qatar.

## Interaction and reliability

The composer is loaded only in authorized staff/tutor portals. Examples are role-aware. Lookups/reports are read-only; writes require a preview and confirmation. Removal, cancellation, family-link changes, tutor revocation and shared-calendar changes require acknowledgement. Same-name creation requires the operator to distinguish a separate person.

Student/class/tutor IDs come from scoped service reads and select controls, not arbitrary text. Selecting a linked class fills known student/tutor/topic details. Tutor creation of staff-managed records remains an unsaved draft; typing does not expand privileges. Server RLS and existing database guards remain authoritative. Existing booking and calendar operations retain version checks. Ordinary records are re-read before execution; changed or inaccessible targets fail before mutation. These client rechecks are not a replacement for transactional server authorization and do not make every legacy CRUD operation an atomic compare-and-set.

Ordinary creates retain one UUID per task preview. Retrying after a lost response first searches for that ID and recovers the existing record. Assignment retries resolve the existing student/tutor relationship. Calendar, exam, availability and booking outcomes use the existing services: if a response fails after a save attempt, the UI blocks blind retry and directs the operator to verify the normal record screen. Drafts are memory-only and reset on account/role changes.

Retained deletion removes records from active views; it does not cascade-delete related records. Creating people does not create logins, send invitations or automatically assign tutors. Class cancellation does not invent billing or make-up outcomes. Materials are links, not uploads. Notes appear only for selected audiences; there is no new email/WhatsApp delivery. Reports display actual returned records rather than fabricated academic scores. Existing published calendar reference dates can be inspected in combined lookup; reference overrides/removals continue through the full Master Calendar screen.

## Boundaries

This is a bounded command catalogue and editable task-card workflow, not an unrestricted language agent. Commands do not alter permissions, change account roles, post financial corrections, send external messages, upload files, bulk-delete records, or negotiate a confirmed recurring series. Existing booking requests can still confirm/propose a recurring schedule. Single-class staff edits retain the existing scheduling constraints and are not described as family-accepted proposals.

## Verification

The isolated release built on production commit `00046abab8940e72467ec76baf5ac6a1659fbb47` passes all 221 tests, the production build and built-artifact public/sign-in render checks. The first broader run encountered a Windows EBADF file-access error in an unrelated component; a full rerun and the isolated release both passed. Task features load in a separate portal chunk rather than increasing the public entry bundle.

`tests/task-commands.test.js` covers supported phrasing, Qatar day boundaries, role denial and unsaved drafts, actual payloads, linked-record validation, private sharing, lesson attendance, stale previews, retained deletion, booking recurrence/version, timed calendar rollover, availability bounds, lost-response recovery, parent/tutor linking, combined calendar lookup and scoped report failures.

`tests/student-command-ui.test.js` covers editable previews, duplicate-person acknowledgement, lost-response recovery, tutor drafts/search, exact-lesson attendance, deletion acknowledgement, unsupported input preservation and family-role exclusion. Existing PostgreSQL workflow tests continue to verify server authorization and scheduling constraints. No production test records are created by these tests. Native browser visual review and authenticated production mutations are separate checks and must not be inferred from DOM tests.

