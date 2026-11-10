-- Read-only. Changes nothing and returns no personal data.
-- Paste into Supabase > SQL Editor and run; it returns one table to review before migrating.
select 'profile_roles' as section, role || ' / ' || status as item, count(*)::text as detail
  from public.profiles group by role, status
union all
select 'profiles_update_grant', grantee, string_agg(privilege_type, ', ')
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'profiles' and privilege_type = 'UPDATE'
  group by grantee
union all
select 'profiles_column_update_grant', grantee, string_agg(column_name, ', ')
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'profiles' and privilege_type = 'UPDATE'
    and grantee in ('PUBLIC', 'anon', 'authenticated')
  group by grantee
union all
select 'rls_disabled', c.relname, 'row level security is OFF'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all
select 'policy', tablename || '.' || policyname, cmd || ' to ' || array_to_string(roles, ',')
  from pg_policies where schemaname = 'public'
union all
select 'function', p.proname, pg_get_function_identity_arguments(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
union all
select 'column_not_null', 'class_notes.' || column_name, is_nullable
  from information_schema.columns
  where table_schema = 'public' and table_name = 'class_notes' and column_name = 'class_id'
order by 1, 2;
