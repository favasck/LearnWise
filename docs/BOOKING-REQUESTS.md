# Availability, recurring requests and exam planning

Portal route: `/portal/bookings`. Updated 15 November 2026.

## Family booking

A linked parent or student selects the student record and enters the student's name, details, subject, class mode and location. Names/details are booking snapshots; they do not change the linked student record or grant access to another student. In-person requests require an address. Session length is selected from 1, 1.5, 2, 2.5 or 3 hours.

Families choose a published date/slot or suggest their own first session, with up to two alternative first-session times. Published windows contain no preferred-area option. Tutors can offer online, in-person, or either mode. Free start times are calculated every 15 minutes for the selected duration, mode and address, excluding class/travel and student-exam clashes.

Repeat options are one session, once weekly, twice weekly, every two weeks, or monthly. Families choose the weekday(s) and a finite session count. Weekly patterns use the first session's time on every chosen day; fortnightly uses alternate Sunday-based weeks anchored to the first session. Monthly uses the original day of month, clamped to the month's last day when needed. The UI previews every date. A published window applies to the first session only; the tutor explicitly reviews later dates. Up to 24 sessions are supported within a year of the first date (the monthly UI caps at 12). The first session must be within 180 days.

## Tutor review and calendar

The planning calendar shows confirmed classes, pending requests, proposed schedules and student exam dates with visible status labels and distinct colors. Clicking a request opens its review card. Pending/proposed dates do not reserve time. Families see only their own classes, requests and exams; tutors/staff retain existing team scope.

Tutors can confirm the submitted schedule, decline with a reason, or propose a different date/time, duration, class mode, location and repeat pattern. Proposals show all updated details and require family acceptance. The request history retains snapshots of the original and subsequent details. Version checks reject stale responses.

Confirmation generates all occurrences as ordinary classes linked by `booking_request_id`. A request row lock, unique class occurrence index and transaction advisory scheduling lock protect posting. Any class, student, travel or exam clash on any occurrence aborts the entire series. No invoice/charge is created by the request workflow. Existing dated requests and confirmed classes are preserved. Further changes to confirmed individual classes use existing Classes controls; negotiating edits to an already confirmed whole series is outside this release.

Travel rules use the larger adjacent buffer when locations differ or switching between online and in-person classes. Exact matching nonempty in-person addresses permit adjacent lessons. Tutors must verify addresses; no map-distance service is used.

Parents, students and authorized tutors/staff can add, edit and retain-delete student exam entries within their existing scope. Adding an exam records the actual exam even if a class already exists; the calendar makes both visible so the class can be changed. New confirmations and moved/reactivated classes cannot overlap that student's recorded exam. Exam changes and class confirmations share the scheduling lock. Exam data is entered manually; no official timetable feed is implied.

The share link opens sign-in and grants no access on its own. Portal notices refresh on focus and every minute. No email or WhatsApp messages are sent.

## Database and verification

Apply source files in order after the scoped-team/private-RPC migrations:

1. `docs/sql/booking_requests.sql` — applied as `20261115083038_tutor_availability_booking_requests`.
2. `docs/sql/recurring_booking_review.sql` — applied as `20261115090400_recurring_booking_review_and_student_exams`.

The CLI package is unavailable in this environment; the connected Supabase tool created the versioned migrations. The upgrade removes the area requirement, retains the deprecated column for compatibility, adds recurrence/student snapshots, class linkage and exam entries, and keeps the original time-only response RPC for older clients. New clients use `review_booking_request` and `booking_slots_v2`.

Booking and exam tables use RLS. Anonymous reads/RPC execution are revoked. Clients cannot directly change requests or activity history. Exam column grants prevent changing identity/creator; scoped policies restrict reads and writes. Checked invoker API wrappers call private privileged implementations. Live metadata and recurrence queries verified the upgrade; the security advisor found no new database findings.

Validation: all 151 local automated tests pass, including PostgreSQL-compatible PGlite workflow tests, recurrence/preview parity, month ends, every repeat frequency, later-occurrence rollback, exam isolation, fixed durations, full tutor proposals, acceptance and retry preservation. DOM tests cover typed student details, duration options, weekday selection and the combined calendar. Production build and built-application render checks pass. Authenticated browser and simultaneous multi-connection load testing have not been performed.
