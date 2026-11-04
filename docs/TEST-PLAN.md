# Test plan

Use `npm test` for isolated PostgreSQL permission regression tests and `npm run build` for bundling. PGlite runs real PostgreSQL in memory without external database access. Node's built-in runner avoids adding a separate unit-test framework for this initial SQL batch.

Fixture creates Supabase-like auth roles/auth.uid(), baseline table definitions and original RLS/functions. It precreates tables to bypass confirmed baseline forward-reference defects and omits unused uuid-ossp because it is unavailable in PGlite. It supplies representative baseline table/column grants. Tests SET LOCAL ROLE authenticated/anon rather than exercising database-owner permissions. Synthetic example.test identities only. Each attack runs in a rolled-back transaction.

Coverage in batch 1: reproduce legacy escalation, block student/parent/tutor promotion to admin/super_admin/admin_tutor, protect status/email/ID, allow name/phone changes, isolate other profiles, authorize admin RPC, validate payloads, reject suspended/anonymous actors, prevent audit modifications and roll back mutations on audit insert failure.

Required next layers: approved nonproduction Supabase PostgREST requests (PATCH and RPC), Auth signup/session/recovery tests, real role inventory/migrations, relationship isolation on every table, assignment revocation and suspended sessions, audit disclosure, concurrency/deadlocks, payment idempotency/corrections and scheduling conflicts. Add component/browser tests for portal workflows, forms, error states and responsive layouts as components change. Test recurrence, attendance, fees, homework, assessments and resources when those capabilities exist; do not substitute tests of nonexistent features.

Do not connect test fixtures to production or send messages/payments. In-app QA's createTestData is not an automated authorization test and must not be used against production.

Batch 2 adds authSession unit tests with controllable session and profile promises, explicit deferred callbacks and fake Supabase methods. These exercise production session-controller logic without network access. Browser coverage must still verify React provider mounting/unmounting, account switching across portals, linked-record retry, missing profiles and sign-out failures against a nonproduction project. CI runs the same local tests/build on Node 24; no credentials are required.

Rendering checks now load the actual JSX through Vite for React server rendering and execute the built JavaScript with jsdom via npm run test:render. The artifact check blocks all application fetches and requires a rendered homepage, navigation through seven public pages and a working transition to the sign-in form; it rejects runtime errors, empty content, unavailable screens and unresolved loading. Browser screenshots, real session navigation and authenticated portal persistence remain separate requirements.
