# Architecture

Current: index.html → src/main.jsx → AuthProvider → App. App holds public pages, shared UI and all portal components in one file, with state navigation. AuthContext manages sessions/profiles; Supabase client reads Vite public configuration. Active data service is src/services/supabaseData.js. Direct Supabase access still occurs in components. There is no server runtime in this repository. PostgreSQL RLS is the security boundary.

Batch 1 changes only privileged profile writes: data service → admin_update_profile RPC → persisted actor authorization → profile UPDATE + permission_audit_events INSERT in one transaction. Normal self-service profile writes can update only name/phone. No roles are automatically migrated.

Incremental target: extract shared components and feature hooks first, then public/admin/tutor/parent/student pages. Keep behavior compatible during extraction. Move critical scheduling/financial/permission invariants into transactionally secure functions. Consolidate the unused duplicate service only after import/behavior tests. Introduce organization isolation only with an explicit tenancy model; do not invent default tenant ownership.

Future communication uses a transactional outbox and adapters; marketplace transactions remain distinct from tuition accounting. Protected storage and curriculum hierarchy precede academic commerce. No architectural rewrite is required for batch 1.

Batch 2 extracts authSession into features/auth as an injectable controller owned by AuthProvider. It has start/stop/refresh/clear operations, synchronous auth notifications, deferred profile reads and monotonically increasing request revisions. Profile creation belongs to the DB signup trigger. App's linked academic profile state is keyed by user ID and role and cancelled on effect cleanup. Failure states render retry controls. No database authorization is replaced by these client guards.
