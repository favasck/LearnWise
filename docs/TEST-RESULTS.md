# Current draft verification — firm permissions and onboarding

115 tests pass, 0 fail. New tests load every supplied production policy and the supplied role-helper expressions, including broad legacy permissions. The two summarized function bodies and missing table DDL/grants are explicitly identified as reconstruction/scaffolding, not exact exports. Earlier reconstructed-policy tests remain historical coverage of the preceding candidates.

The latest production build passes (1553 modules; 390.11 kB JavaScript / 99.31 kB gzip using the equivalent programmatic Vite build). The protected-workspace DOM test selects a firm and verifies permission-driven controls; the public artifact check renders seven pages and sign-in without backend calls or runtime errors. Real Supabase REST/auth/email/advisors and browser appearance/concurrent sessions remain release checks.

No production query, attack, migration, account mapping, message or manual deployment was performed. The new SQL is a locally tested candidate outside migration discovery. See [current behavior and release boundaries](FIRM-ACCESS.md).

---

# Current branch review — 10 November 2026

94 tests pass, 0 fail after replacing the invalid legacy-role fixture tests. The reconstructed fixture uses the reported five-role constraint and all three staff accounts; the full production policy/function export is still missing. This is not production verification. Private-view protection was withdrawn rather than claimed fixed.

The equivalent programmatic Vite build passed (1549 modules, 375.79 kB JavaScript / 95.15 kB gzip); the usual local configuration-loader parent-directory restriction remains. Seven public pages and sign-in render with no errors or backend requests. Remote CI must verify the standard build. No production query, attack, migration, deployment or account mapping was performed. The site/signups stay open for team testing.

See [the current evidence assessment](LAUNCH-BLOCKER-FIXES.md). All older results below describe earlier candidates and cannot establish production readiness.

---

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

## Exact preview follow-up (2026-11-04)

User identified https://learn-wise-g6s4646k7-fawazs-projects-788a623d.vercel.app/. An unauthenticated request to that exact URL redirects to vercel.com/login and returns the Vercel login page. Access protection was not bypassed. CLI account check reports logged out. Exact preview environment variables and rendered app state remain unverified.

Confirmed an independent startup defect in the security branch: missing Supabase configuration suppressed the entire public website. Removed that dependency. AuthProvider now supports a public session without a client; account operations and public submissions return controlled errors. Contact no longer reports a successful send after a service failure.

Verification: npm test PASS, 55 tests; npm run build PASS; npm run test:render PASS with homepage=true, unavailable=false, loading=false, blockedRequests=0, errors=[], publicPages=7, signInForm=true. These are actual built-JavaScript DOM checks with no Supabase credentials or backend requests. The specific cause of the user's blank page is not yet proven; no claim of authenticated live-preview verification is made.

## Staging readiness preparation (2026-11-05)

Vercel account check still reports logged out. No Supabase environment variables or staging file were present. Supabase and Vercel integrations were discovered as available but not installed/connected and suggested to the user. Their connection has not been confirmed.

Added scripts/staging-readiness.mjs and npm run check:staging. Fourteen targeted tests pass, covering connection approval, URL validation, key/session validation, GET-only behavior, missing RPC, inaccessible API, sanitized failures and modern publishable keys. Executing the actual staging command reports staging_configuration=blocked and makes no external request. Full authenticated integration testing remains pending. See STAGING-VERIFICATION.md for setup and exact limits.

Full local suite after this batch: npm test PASS, 69 tests, 0 failures. git diff --check PASS. This batch changes tooling/documentation only; application assets and database state are unchanged.

## Launch preparation — 2026-11-07

Verified shell runtime: Node 24.18.0 at `C:\Program Files\nodejs\node.exe`. `npm test` PASS: **92 tests, 0 failures**, including all 69 pre-existing cases. The supplied machine context reported Node 20.19.0, but this execution shell resolves Node 24. No local Node 20 executable was found in the standard installation/version-manager locations, so Node 20 execution is not claimed. The explicit-file runner removes the identified Node 20 glob-expansion defect using APIs/CLI options supported by both versions.

`npm run build` PASS: Vite 5.4.21, 1548 modules, bundle `index-suPLJqq8.js` (375.22 kB, 94.58 kB gzip). No production credentials were needed. `npm run test:render` also PASS: seven public pages and the sign-in form, homepage=true, loading=false, blockedRequests=0, errors=[]. This verifies the built artifact with missing backend configuration, not a live deployment.

New checks cover injected DNS/network failure, stalled requests/client/session calls, backend 5xx, preserved validation responses and successful minimal responses; public rendering during session failure/loading; real data-service failure propagation and public form insert payload/readback behavior. Vite SSR harnesses use isolated caches and unlistened HTTP transports so parallel tests do not fight over a websocket port.

The bootstrap regression uses real PGlite PostgreSQL with only Supabase roles/auth schema/auth.uid() stubbed. It runs the actual bootstrap twice, applies actual profile hardening, then replays bootstrap. Assertions cover all 14 resulting application/audit tables with RLS/policies, RPC presence, denied escalation after replay, audited administrator changes, signup role sanitization, related reads without recursion, attendance-only tutor updates, forbidden academic assignments, private-note visibility, assignment revocation, public insert/no read, and suspension. The owner checklist's first-admin SQL is executed against a confirmed test user and rejects a second bootstrap administrator setup.

Not verified: live Supabase auth/email, external database migrations, restored data compatibility, Vercel settings, protected preview or real role click-through. The known non-resolving project was not re-investigated. No credentials were sought and no external settings/data were changed. See FEATURE-AUDIT and LAUNCH-CHECKLIST for larger launch gaps.

Git work remains uncommitted on the pre-existing `codex/launch-ready` branch at 363b1da: `git add` and `git commit` both failed because this workspace denies `.git/index.lock` creation. Claude Code must review and create the separate task commits. No push attempted.

