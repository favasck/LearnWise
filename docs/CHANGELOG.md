# Development batches

## UI experience release completion — 2026-11-10

Completed the public About, Subjects, Curriculum and Online Tuition redesign; added subject-preserving assessment links, refreshable/expiring password recovery and expired-link handling. Filtered portal queries now recover from missing backend configuration. Standard build works in Windows sandbox and CI. Local suite: 106 tests pass; live rollback-only assessment/signup/profile probes pass. Deployment is authorized through the existing GitHub/Vercel integration. Separate draft permissions work is excluded; visual browser access and SMTP delivery remain unverified. Details: [UI-EXPERIENCE.md](UI-EXPERIENCE.md).

## UI experience foundation — 2026-11-10

Local branch `feat/ui-experience`: redesigned public homepage/navigation/footer, URL-based public and portal routes, responsive portal drawer/grids, shared accessible forms/dialogs, assessment review flow, recoverable contact validation, clearer login/signup and password recovery. Added rendered interaction tests and fixed the SQL-fence test's Windows line-ending assumption. See [UI-EXPERIENCE.md](UI-EXPERIENCE.md) for scope and verification limits. No deployment or external data change performed.

## Batch 0 — read-only assessment

Inspected latest working tree and recent history, architecture, source service/auth/role modules, SQL policies, public and portal actions, delivery/configuration and dependency manifests. Confirmed the master specification's ten known source findings remain relevant. Assessment written in audit/CURRENT-STATE.md; no production access.

## Batch 1 — local profile privilege boundary

Branch: security/p0-profile-escalation. Added candidate versioned SQL migration with field-restricted profile grants, persisted-admin authorization, narrow privileged RPC and atomic minimal permission audit. Updated the active data service's profile role/status operation to use RPC. Added isolated PostgreSQL regression suite and npm test script; added env example/gitignore and maintained assessment, backlog, architecture, permissions, schema, test and deployment documents.

Verified 29 DB tests and production build. Migration remains unapplied externally. General audit_logs UI, canonical role migration, other-table RLS, suspension revocation and financial/scheduling repairs remain open. No production data, messages, payments or deployment touched. See TEST-RESULTS for limitations and dependency advisory results.

## Batch 2 — authentication lifecycle and local CI

Extracted a testable session controller into src/features/auth/authSession.js. Auth notifications now return synchronously; profile queries run afterward. Request revisions reject results from older sessions, refreshes and stopped providers. Session/profile failures clear permission state, stop loading and allow retry. Missing profiles are no longer created by browser fallback; the existing handle_new_user database trigger is authoritative. Signup role sanitization remains intact.

AuthContext uses this controller and clears local permissions immediately on sign-out. App keys linked tutor/parent/student data to the current user/role, cancels stale lookup results, distinguishes lookup failures from genuinely unlinked accounts, and shows retry/sign-out controls instead of silently falling back to public pages.

Added 14 deterministic auth-controller tests and a GitHub Actions workflow for npm installation, tests and build. Local full suite: 43 tests pass; production bundle builds. No new dependency or migration in this batch. CI has not run remotely; React/browser interaction tests and real Supabase integration remain outstanding. Legacy ownership and database drift remain prerequisites for canonical-role migration.

## Batch 3 — deployment preparation

User authorized Git and Vercel deployment. Added safe Supabase initialization and an unavailable page for missing/invalid configuration, preventing the previous module-initialization crash. Added six configuration tests. Preserved all existing database and role decisions; migrations remain local candidates. Added .vercel to ignore rules. Full test suite: 49 pass. Deployment/remote check results are recorded separately as they occur.

Committed as 9bb89a8 and pushed the security branch. Existing Vercel GitHub integration completed its Preview deployment; remote CI passed. Unauthenticated live check reached the Vercel login gate, so rendered-app and authenticated portal verification remain outstanding. No production promotion or migration performed. TEST-RESULTS and DEPLOYMENT contain the verified preview link and evidence.

## Batch 4 — blank-page investigation and render coverage

User reported a blank page. Public production HTML/assets load, and its downloaded JavaScript renders the homepage in an isolated DOM with application network access blocked. This does not reproduce the reported failure; the exact URL and live browser inspection remain outstanding. Added source-render and built-artifact checks, jsdom as a development dependency, and a CI artifact-render step. Exported the existing AuthContext for isolated component rendering. No production behavior, database policies or data changed in this batch; no blank-page fix is claimed.

## Batch 5 — public startup independent of Supabase

User supplied the exact preview URL; unauthenticated access reaches the Vercel login gate. Fixed the confirmed source behavior that suppressed public pages when preview/backend configuration is absent. Public pages now render normally, account actions/submissions fail with clear errors, and contact errors cannot produce false success. Strengthened the built-artifact check to require the homepage, seven public routes and the sign-in form. Local verification: 55 tests, build and artifact-render check pass. Protected preview runtime/configuration remains unverified pending Vercel account access. No database migrations or production promotion performed.

## Batch 6 — staging readiness and connection discovery

Rechecked Vercel access and local staging configuration: still unavailable. Discovered and suggested Supabase/Vercel integrations, neither confirmed connected. Added a read-only staging API checker, an empty staging configuration example, ignored local staging configuration, and 14 targeted tests. The checker stops before network use until an approved staging project/session is provided, checks only metadata, and requires the new permission RPC to be visible. No browser protection, role mapping or database state changed. Authenticated portal testing remains pending account/project access.

## Launch preparation — 2026-11-07 (pending review/commits)

1. Added a portable explicit-path test launcher for Node 20/24; the original 69 tests passed unchanged with the runner. Verification shell resolves Node 24.18.0; Node 20 execution was not available.
2. Added bounded resilient Supabase fetch/auth/session handling with friendly service-unavailable errors. Public routes remain available while session initialization fails or waits. Dashboard services propagate backend errors. Added injected fetch/client and source-render coverage.
3. Added ordered, replayable `202611070001_bootstrap_schema.sql` for every active application table, including general audit logs. Run it explicitly before `202611030001_protect_profile_updates.sql`. Profile permission protections are unchanged; bootstrap replay never restores broad profile UPDATE. Relationship helpers avoid recursive RLS and require active persisted roles/assignments. PGlite tests apply the real migration pair to an empty database and verify replay/security and owner first-admin SQL.
4. Audited every product specification requirement in FEATURE-AUDIT. Fixed public insert readback denied by RLS and the Contact form's missing student name. Public payload fields are allowlisted. Replaced the stale duplicate data service with a compatibility re-export; preserved its previous contents under `_archive/src`. Larger scheduling/billing/roles/privacy/academic gaps are explicitly listed.
5. Wrote owner instructions in LAUNCH-CHECKLIST: project recovery, exact migration order, both Vercel environments, first administrator SQL, public deployment protection, and per-role click-through checks. Updated deployment and permission documentation.
6. Final required local checks: 92 tests pass, build and built-artifact render check pass. External restoration, migrations and live portal verification await owner access. No push, credentials, deployment or external data changes. Separate commits could not be created because `.git` writes are denied in this workspace; all changes remain pending on `codex/launch-ready` for Claude Code.
