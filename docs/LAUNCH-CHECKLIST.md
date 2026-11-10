> Current implementation: [Firm access and onboarding](FIRM-ACCESS.md). The supplied production policy export is now installed in the new fixture. Later decisions permit explicitly delegated, firm-scoped Admin void/correction powers and tutor-created student/parent records. Earlier fixed-role restrictions and requests for a policy export below are historical. Production remains unchanged; PR #2 stays draft.

# Team testing — production changes prohibited

LearnWise is not launching publicly now. Keep the existing site and signups open for team testing. Do not merge/deploy PR #2 or run its migrations on production project `jllisbpzphxhbqqdpvtz`.

The prior service-restoration instructions and legacy `admin` bootstrap SQL have been withdrawn. Do not use them to promote accounts or recreate the existing production database. The owner declined the organization-wide Supabase connection; do not request it again.

1. Obtain the read-only metadata export from `scripts/production-role-export.sql` through the owner's existing workflow. It reads schema, policies, function definitions and grants; no application records. Review definitions privately for any hardcoded secrets before sharing them.
2. Compare the export with the clearly labelled reconstructed fixture in `tests/helpers/reported-production-fixture.js`. Replace synthetic policies and the old payment-function stub with the actual reviewed definitions. No production exploit testing.
3. Decide Tutor Admin authority for invoice cancellation, corrections/reversals and non-self safe profile edits. Current candidate withholds these capabilities.
4. Review the profile-only policy repair and old payment-overload revocations locally. Keep unrelated policies intact. Verify both Super Admins and the Tutor Admin retain their roles and expected access, including tests for suspension and forged metadata.
5. Review the field-disclosure matrix and build a replacement privacy design from actual policies. `202611090002_portal_privacy.sql` intentionally raises an exception; its generator is disabled. The frontend no longer requires the withdrawn views. Private-field protection remains unresolved.
6. Continue invented-data team testing of login, note saves, scheduling, invoices and payment retries against an approved test database. Local PGlite checks are not Supabase API, email, browser or real concurrency verification.

This is a review workflow, not a production migration order. Any future rollout requires a separate owner instruction after these uncertainties are resolved. See `LAUNCH-BLOCKER-FIXES.md`.
