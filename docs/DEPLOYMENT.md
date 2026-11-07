# Local setup and migration review

The user has authorized Git publishing and Vercel deployment. Release preparation targets the security branch and a Vercel preview; production promotion awaits verified database compatibility. Database migrations remain unapplied. Node 24.18.0 was used for verification. Install locked packages with `npm ci`; copy .env.example to .env and use an approved nonproduction Supabase URL/public anon key. Never put service-role keys in VITE variables. Run `npm test`, `npm run build`, then `npm run dev` for manual review. A passing Vite build does not prove Supabase is configured or reachable.

Do not blindly run supabase_setup.sql against production or an empty project: it contains forward-reference and replay defects and does not upgrade old constraints. It is retained as baseline evidence. Use the new clean bootstrap below for an empty project.

## Candidate 202611030001

Before applying: obtain a read-only schema/grant/function/RLS export, confirm actual profile columns and role values, role memberships and function ownership, verify legacy admin owners and check no permission_audit_events object already exists. The migration deliberately fails on audit-table collision rather than accepting unknown drift. Review role decisions separately; this migration promotes nobody and recognizes only the known legacy admin authority.

Test in an isolated Supabase project matching the actual schema. Apply this migration once through the approved versioned migration process. Deploy the corresponding active data-service change only with the RPC available. Test direct authenticated PATCH and RPC requests for each role, allowed profile edits, admin changes/audit records and suspended actor rejection. Retain evidence with no production PII.

The migration is transactional and safely aborts on error. For post-application rollback, revert the frontend and prepare a reviewed forward migration; do not restore broad profile UPDATE grants, remove audit history or reintroduce the exploit. Coordinate client/server compatibility before release. This repository currently has no automated production migration runner. Existing audit_logs UI does not yet display the new permission-specific audit events.

Missing or invalid Supabase configuration leaves public pages available. Account actions and public submissions return an unavailable error without constructing a fake client, contacting an invented endpoint or exposing keys. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel for the intended environment before building to enable backend workflows. No local credentials are present. Preview deployments are not evidence that role-based workflows work against an approved database.

## Verified preview

The existing GitHub integration deployed source commit 9bb89a8 from security/p0-profile-escalation successfully to [Vercel Preview](https://learn-wise-h810e3uov-fawazs-projects-788a623d.vercel.app). GitHub CI also passed installation/tests/build. Unauthenticated access redirects to Vercel login; an authorized account must open the preview for browser verification. Do not disable deployment protection as a testing shortcut. Production promotion still requires verifying the RPC migration and approved environment configuration.

Use the read-only staging procedure in STAGING-VERIFICATION.md before further release approval. npm run check:staging checks metadata and required RPC visibility only; it does not apply the migration or prove authorization. Missing RPC must be resolved through the reviewed database migration process rather than an insecure frontend fallback.


## Empty-project bootstrap (2026-11-07)

Follow [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md). Run `migrations/202611070001_bootstrap_schema.sql` FIRST, then `migrations/202611030001_protect_profile_updates.sql` once. The explicit order is intentional despite the dates; do not feed these files to a runner that sorts names. The bootstrap creates all application tables before relationship helpers/policies, avoids policy recursion, and can be replayed before or after profile hardening without restoring profile permission grants. It preserves legacy admin authority and does not implement canonical staff roles. Existing populated databases need a drift review first.

Local PGlite tests now apply both actual files to an empty database with only Supabase auth schema/roles stubbed. Production remains blocked by the owner-controlled Supabase project restoration. Vercel Production and Preview both need real project URL/public anon configuration and fresh builds. No credentials, environment settings, database access or deployment was changed.
