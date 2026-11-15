# Availability and booking requests

First release, 15 November 2026. Portal route: `/portal/bookings`.

Tutors and scoped staff publish dated availability windows with mode, preferred area and a travel buffer. They can close a window without cancelling confirmed classes. The share link opens the portal after sign-in; only a linked parent/student with an active tutor assignment can request a class. The link contains no personal data and grants no access by itself.

Families select an availability window or suggest their own time, choose one to three preferences, and supply subject, duration, location and flexibility notes. Free start times are calculated at 15-minute intervals for the selected duration and address. Requests are one-time and never reserve a slot. They do not create invoices, charges or attendance records.

Tutors review pending requests alongside that day's classes and locations. Confirming the original first preference creates one normal Scheduled class. To choose any other preference or time, use Propose another time. Only the family can accept a proposal. Declines require a reason in the interface; families can withdraw unresolved requests. All transitions have retained activity records. Portal notices refresh on focus and every minute; this release sends no email or WhatsApp messages.

Confirmation rechecks current assignment, future time, availability for an unchanged original request, and class conflicts. Expected versions reject stale replies; row locks and a unique class reference prevent repeated confirmation. Schedule mutations from existing admin forms also use the transaction-scoped conflict guard. Tutor and student overlaps are blocked. Different locations or switching between online and in-person sessions use the larger adjacent travel buffer. Exact matching, nonempty addresses allow consecutive in-person classes. Area labels are guidance; the tutor must verify actual addresses. No geocoding or route-distance service is used.

The conflict guard serializes scheduling changes with one transaction advisory lock. This is suitable for the current small operation; revisit lock granularity before scaling. Existing overlapping records are not rewritten. Historical attendance/status changes remain possible without rescheduling a lesson. New or moved sessions must last 15–240 minutes.

## Database and release evidence

Source: `docs/sql/booking_requests.sql`, applied to the LearnWise project through Supabase migration `20261115083038_tutor_availability_booking_requests`. Requires the existing scoped-team and private-RPC migrations. The local Supabase CLI could not be downloaded in this environment, so migration creation/application used the connected Supabase tool and its generated migration version.

All three tables have RLS. Anonymous reads and RPC execution are revoked. Authenticated clients cannot insert/update requests or activity rows directly; checked invoker RPC wrappers call private implementations. Availability writes are limited to the tutor or authorized scoped staff. Free-slot responses contain timestamps only. Live grant/RLS queries verified these boundaries; the security advisor found no new database findings.

Validation: 134 automated tests pass, including real PostgreSQL-compatible PGlite workflow tests and DOM interaction tests for tutor proposals, family acceptance and retry preservation. Production build and built-application render checks pass. Tests cover unrelated-family isolation, stale versions, repeat acceptance, revoked assignments, closed windows, tutor/student overlap and same/different location travel rules. No authenticated browser acceptance test or simultaneous multi-connection load test has been performed.

Future phases: weekly recurrence and exceptions, explicit reschedule negotiations, waitlists/expiry, location grouping suggestions, map travel estimates, and optional messaging integrations.
