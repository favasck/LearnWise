> Superseded production assumptions: the 10 November owner report identifies five canonical roles and an existing working backend. Older legacy-admin/missing-note/deployment statements below are historical, not current release instructions. PR #2 remains blocked; see [the current review](LAUNCH-BLOCKER-FIXES.md).

# Staging connection and read-only verification

Do not promote this branch based on build status alone. The existing preview is protected by Vercel login, Vercel CLI is logged out, and the checkout has no staging connection. Supabase and Vercel integrations were discovered as available but not installed/connected. Enabling them and identifying the approved nonproduction Supabase project is the preferred next step; no credentials should be pasted into chat.

## Local checker

`npm run check:staging` reads only `.env.staging.local`; it does not inherit a production connection from generic `.env` files. Copy the committed empty `.env.staging.example` to that ignored filename, then populate it locally using an approved nonproduction project and disposable staging user. Keep LEARNWISE_STAGING_APPROVED=false until the project has been explicitly identified as staging. Never use a service-role key or production user session.

The checker rejects missing approval, invalid/nonlocal HTTP URLs, embedded URL credentials, privileged keys, expired sessions and sessions issued by a different project. Legacy anon and modern publishable keys are supported. Token claims are checked for consistency; the remote service still validates token signatures. Configuration is operator-provided: this script cannot independently prove a project is nonproduction.

The only network operations are GET /auth/v1/settings and GET /rest/v1/ with an authenticated staging session. Redirects are rejected and requests time out. No user rows are read, no sign-in is performed, and no RPC or database mutation is invoked. The OpenAPI schema must advertise POST /rpc/admin_update_profile. Missing or inaccessible RPC means role/status updates are not ready for release; the checker does not fall back to the unsafe legacy profile update.

Output contains only named checks and fixed status messages. Credentials, raw backend errors and response bodies are not printed. A passing result establishes these metadata checks only. It does not establish correct role authorization, all migrations, audit reliability, actual portal persistence or end-to-end readiness. Staging-session creation, real role tests and portal verification remain follow-up work after access is configured.

## Current execution result

The 14 new checker tests pass with synthetic credentials and injected HTTP responses. Running the actual command stops with staging_configuration=blocked because .env.staging.local does not exist. No external database requests or changes were made. No staging project or account has been fabricated.

