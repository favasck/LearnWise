# Development batches

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
