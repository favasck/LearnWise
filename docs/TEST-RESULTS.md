# Test results

Batch 1, 2026-11-03, baseline 154984c plus local candidate changes; Node 24.18.0 on Windows.

| Check | Actual result |
|---|---|
| Locked dependency installation | Passed after required sandbox escalation; initial sandbox attempt failed on npm-cache permissions. Install lifecycle scripts disabled. |
| Initial DB suite | Failed on baseline forward-reference ordering (student_tutors referenced before creation). Fixture adjusted to precreate exact table definitions; baseline source not silently repaired. |
| `npm test` | PASS: 29 tests, 0 failed, including baseline exploit reproduction and post-migration rejection. |
| `npm run build` | PASS: Vite 5.4.21, 1545 modules; JS bundle 585.50 kB / gzip 148.45 kB. Warning for >500 kB chunk. |
| Supabase API/browser tests | Not executed: no approved nonproduction project/session provided. |
| Production schema/Auth/storage verification | Not executed. No production requests made. |
| `git diff --check` | PASS, no whitespace errors. |
| `npm audit --json` | Exit 1: 7 affected packages (5 high, 2 moderate, 0 critical). Affected: Vite, esbuild, browserslist, nanoid, postcss, source-map-js, baseline-browser-mapping. No forced upgrade performed. |

Passing SQL tests verifies the candidate under the documented baseline fixture, not the deployed Supabase schema, PostgREST behavior, all role isolation, full audit system or end-to-end application readiness. The advisory result concerns the current build/development dependency tree; exploitability in this application is not established by severity counts. Triage includes [Vite Windows editor handling](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [esbuild development server access](https://github.com/advisories/GHSA-67mh-4wv8-2f99), and the additional advisories returned by npm. Update tooling in a separate compatible, tested batch; do not use a forced major-version audit fix without review.

## Batch 2

| Check | Actual result |
|---|---|
| `npm test` | PASS: 43 tests, 0 failed (14 auth-controller tests plus 29 existing database tests). |
| Auth scenarios | Synchronous callback/deferred query, logout, account switch, stale initialization, restored/empty session, missing/error/wrong-identity/rejected profile, refresh/suspension data, clear, unsubscribe and retry. |
| `npm run build` | PASS: Vite 5.4.21; 1546 modules; JS 586.47 kB / gzip 148.80 kB; >500 kB warning remains. |
| `git diff --check` | PASS after application changes. |
| GitHub Actions | Workflow added; remote execution not performed. |
| Browser/component and real Supabase tests | Not executed. Linked-profile UI wiring reviewed and bundled, but controller tests do not establish rendered browser behavior. |

An initial auth test awaited an unresolved synthetic getSession promise and hung; that runner was stopped, the fixture was corrected, and the full suite then passed. No external service was involved. No additional dependency advisory scan was necessary because this batch does not change dependencies.

## Batch 3 — deployment preparation

`npm test`: PASS, 49 tests, 0 failures. Includes six configuration initialization checks (missing URL/key, malformed URL, unsupported protocol, successful factory call and SDK constructor failure). Existing 43 auth/database tests still pass. No real credentials or external database used. Missing configuration now renders a generic unavailable page rather than throwing before React mounts. Live browser verification remains incomplete after Computer Use's URL-safety check stopped the previous browser session; no claim of end-to-end live testing is made.
