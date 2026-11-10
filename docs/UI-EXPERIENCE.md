# UI experience implementation — 10 November 2026

Release branch: `feat/ui-experience-20261110`, based on `3a6445c`. Working copy: `C:\Users\DELL\Documents\learnwise-ui`. The original checkout at `D:\projects\_archive\learnwise\learnwise-repo` is unchanged. See GitHub deployment statuses for the release outcome. No live email or password update was performed, and database probes left no retained test data.

## Release completion

- About, Subjects, Curriculum and Online Tuition now share the new design and semantic headings. Unverified student counts, tutor credentials and recording promises were removed. Subject links preserve the selection through the assessment URL and refresh.
- Password recovery returns to the existing site root, where the early recovery listener opens the reset form. A ten-minute, user-bound session marker supports same-tab refresh without storing credentials. Expired callback links provide a fresh-link action. No new Supabase redirect URL is required for this flow; the existing Site URL still needs to be the production origin.
- Fifteen filtered data queries now build inside the existing availability boundary, returning recoverable errors when configuration is absent instead of throwing during query construction.
- `npm run build` now loads the existing ESM Vite configuration directly. The ordinary command works in this restricted Windows checkout and in CI.
- Full local suite: 106 tests pass. Production build and seven-page built-artifact render check pass. HTTP metadata verified that existing production targets `https://jllisbpzphxhbqqdpvtz.supabase.co`.
- Live Supabase: anonymous assessment insert and student/parent/tutor signup-trigger plus authenticated linked-profile reads passed in rollback-only subtransactions. No emails were sent, no accounts or enquiry rows were retained, and no migrations were applied.
- Native visual review remains unavailable: browser host missing and Edge access approval timed out. DOM interaction tests do not establish pixel layout or native-browser accessibility. SMTP delivery and a real user's password change were not performed.
- The live database has a different five-role permissions model and does not expose `admin_update_profile`. Existing role/status administration remains a separate backend issue. The draft firm-permissions overhaul in PR #2 was deliberately excluded from this UI release. Live advisor warnings were inventoried, not silently altered as part of a visual release.

## Implemented first phase

- New public homepage with an editorial cream/teal layout, learning approach, subject links, and one assessment request journey. Removed the homepage's hard-coded testimonials and grade-improvement claim from this presentation.
- Responsive public navigation with real anchor destinations, current-page indication, disclosure state, outside-click dismissal and Escape focus return. The footer provides explicit staff and student/parent entry points.
- URL-based public and portal navigation with Back/Forward support, refreshable deep links, document titles, focus transfer, and a missing-page recovery action. Existing Vercel rewrites already support direct URLs. Portal routes remain subject to the existing role/profile checks; unsupported sections redirect to that role's dashboard.
- Responsive portal sidebar and native-dialog mobile drawer. Existing grid layouts collapse on small screens; data tables scroll within their own regions. Dashboard content itself is retained for the next phase.
- Shared native disabled buttons, associated field labels, described errors, visible focus styles, reduced-motion support and native dialogs with modal focus containment. Clickable student cards accept keyboard activation. Toasts and errors expose status/alert semantics. Fixed the shared empty-state `body`/`message` mismatch.
- Assessment request in three steps: learning needs, contact details, and review. Validation focuses the first invalid control. Back navigation retains entries. Failed submissions preserve details and offer retry; in-flight requests are guarded against duplicate clicks. Confirmation explicitly distinguishes a request from a booked appointment.
- Contact form now explains missing/invalid fields and preserves entries after failures.
- Reworked login/signup with accessible role choices, password visibility, clear staff entry and setup expectations. Unlinked profiles offer a retry and support link.
- Password recovery request and password-update screens. A synchronous listener registered immediately after client creation retains the recovery event before React mounts; only its user ID is retained. Password updates require the matching recovery session. Live delivery and changes were not exercised.

## Verification

Run `npm test` for database/auth regressions and rendered UI interactions. `tests/ui-experience.test.js` exercises public links, Back/refresh, missing routes, portal drawer/navigation, assessment validation/Back/retry, contact error preservation, dialog naming/focus restoration, early recovery events and account switching, recovery callback configuration and password confirmation.

The existing SQL-fence fixture in `bootstrap-schema.test.js` now accepts CRLF and LF. Its initial failure was caused by a Windows checkout of the checklist, not a database migration change.

The sandbox denies esbuild's parent-directory scan while bundling `vite.config.js`. The equivalent production build passed using the existing Vite/React configuration through the API:

```powershell
node --input-type=module -e "import {build} from 'vite'; import react from '@vitejs/plugin-react'; await build({configFile:false,plugins:[react()]});"
npm run test:render
```

The built-artifact check executes all seven public pages and sign-in with network requests blocked. DOM tests establish rendered interaction behaviour, not pixel layout, native browser focus trapping, responsive overflow, or real service integration.

## Manual checks and separate backend work

1. Review desktop/tablet/360px phone layouts and keyboard journeys in a browser. Browser host access was unavailable and native browser access approval timed out in this session; no screenshots were obtained.
2. Verify actual SMTP delivery and a consenting user's complete sign-in/recovery journey. Database insert/profile contracts have been checked transactionally; this does not prove email delivery.
3. Confirm the existing Supabase Site URL remains the production origin. Recovery no longer depends on a new `/reset-password` allowlist entry. Verify project-specific password-policy errors and expiry on a real link.
4. Confirm the published contact address is monitored. Marketing content has been simplified to remove unsupported numerical and credential claims.
5. Resolve the existing permissions/RPC drift through the separate backend work; do not apply the old legacy-admin migration or the draft firm candidate blindly.

## Remaining roadmap

Next: role-specific dashboards centred on upcoming classes, due work, learning feedback and billing actions; then scheduling/attendance workflows, student detail navigation and persistent filters. Measure real assessment completion and task time before choosing further conversion changes. Visual and SMTP checks remain unverified, not claimed as completed by the automated checks.

Auth references checked against the installed SDK and current official documentation: [password recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [password updates](https://supabase.com/docs/reference/javascript/auth-updateuser). The current [changelog](https://supabase.com/changelog) was reviewed; this change adds no SDK dependency or database migration.
