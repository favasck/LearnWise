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

`npm run build`: PASS, Vite 5.4.21, 1547 modules, output JS 374.13 kB / gzip 94.24 kB for this unconfigured local build. This artifact renders the unavailable screen; a configured Vercel build can differ. `git diff --check`: PASS.

## Remote preview verification

Source commit `9bb89a83ecc008aec0d4eab7ba4ef357fd796b70` pushed to `security/p0-profile-escalation`. [GitHub CI run 41641526458](https://github.com/favasck/LearnWise/actions/runs/41641526458) completed successfully, including locked installation, npm test and npm run build. Vercel's commit status and GitHub deployment 7519540791 report success for environment Preview.

[Preview deployment](https://learn-wise-h810e3uov-fawazs-projects-788a623d.vercel.app). Unauthenticated HTTP check followed a redirect to vercel.com/login and received HTTP 200 with title "Login – Vercel", not the application. This is an access gate, not a passing application smoke test. Protection was not disabled or bypassed. Vercel CLI is logged out; the existing GitHub integration performed deployment successfully. Production remains on baseline commit 154984c; no database migration was applied and no account/portal persistence test was performed against production.

## Blank-page investigation

The user reported a blank page; the exact affected URL has been requested and is not yet known. Browser app access approval timed out. The public production URL https://learn-wise-umber.vercel.app/ returned HTTP 200, title LearnWise Academy, and JavaScript asset index-DYZcLHlr.js (HTTP 200, JavaScript content type). Bundle metadata confirms this is the older production code, not the security-branch preview.

Downloaded that public JavaScript and executed it in an isolated jsdom environment with empty storage and all application fetches blocked: rendered=true, homepage=true, unavailable=false, loading=false, blockedRequests=0, errors=[]. This verifies default DOM execution only, not browser appearance, a persisted user session, CSP behavior or protected preview access. An initial run lacked browser WebSocket support in the Node environment; providing jsdom's WebSocket corrected the harness, and the rerun passed. No backend data was requested or modified.

Added real-source server-render tests for homepage content, account-load failure and unknown-role isolation, plus a built-JavaScript DOM check. The unconfigured local artifact renders its intended unavailable screen without errors. CI now includes the artifact render check after building. No root cause of the reported blank page has been confirmed and no claim of a production fix is made.

Full local suite after these additions: 53 tests pass, 0 fail. Production build passes. These results do not establish that the user's browser or the protected preview is working.
