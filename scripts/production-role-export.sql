-- Read-only metadata export for owner/Claude review. No application rows,
-- credentials, emails, names, auth tokens or exploit requests are queried.
select c.conname,pg_get_constraintdef(c.oid) as definition
 from pg_constraint c where c.conrelid='public.profiles'::regclass;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
 from pg_policies where schemaname='public' order by tablename,policyname;
select p.oid::regprocedure::text as signature,p.prosecdef as security_definer,
 pg_get_functiondef(p.oid) as definition,p.proacl,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prokind='f'
 and (p.prosecdef or p.proname in('is_admin','is_super_admin','is_admin_tutor','record_payment'))
 order by p.proname,signature;
select grantee,table_name,privilege_type from information_schema.role_table_grants
 where table_schema='public' order by table_name,grantee,privilege_type;
select grantee,table_name,column_name,privilege_type from information_schema.column_privileges
 where table_schema='public' order by table_name,column_name,grantee,privilege_type;
select pg_get_userbyid(member)as member_role,pg_get_userbyid(roleid)as inherited_role from pg_auth_members;
select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns
 where table_schema='public' order by table_name,ordinal_position;
