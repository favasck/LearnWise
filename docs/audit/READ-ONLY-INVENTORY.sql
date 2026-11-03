-- Optional evidence collection for an authorized database operator.
-- Read-only transaction; no user names, emails, tokens or row snapshots.
-- This file has NOT been executed against any external project.
begin transaction read only;

select role, status, count(*) as account_count
from public.profiles group by role, status order by role, status;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
order by table_name, grantee, privilege_type;

select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
order by table_name, grantee, column_name, privilege_type;

select c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p');

select t.relname, c.conname, pg_get_constraintdef(c.oid) as definition
from pg_constraint c join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' order by t.relname, c.conname;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) as owner
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by p.proname;

select parent.rolname as granted_role, member.rolname as member_role
from pg_auth_members m
join pg_roles parent on parent.oid = m.roleid
join pg_roles member on member.oid = m.member
where member.rolname in ('anon', 'authenticated');

rollback;
