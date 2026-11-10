-- Read-only aggregate counts only: no student/contact/payment details.
select 'invoice_balance_mismatch' as check_name,count(*) as affected_rows
 from public.invoices i where i.paid_qar<>coalesce((select sum(p.amount_qar) from public.payments p where p.invoice_id=i.id),0)
union all
select 'payment_relationship_mismatch',count(*) from public.payments p join public.invoices i on i.id=p.invoice_id
 where p.parent_id<>i.parent_id or p.student_id is distinct from i.student_id
union all
select 'nonpositive_payment',count(*) from public.payments where amount_qar<=0
union all
select 'duplicate_invoice_number',count(*) from (select invoice_number from public.invoices group by invoice_number having count(*)>1) d;

-- Review all explicit and inherited privileges and exposed definer functions.
select grantee,table_name,privilege_type from information_schema.role_table_grants
 where table_schema='public' and grantee in ('PUBLIC','anon','authenticated') order by table_name,grantee,privilege_type;
select grantee,table_name,column_name,privilege_type from information_schema.column_privileges
 where table_schema='public' and grantee in ('PUBLIC','anon','authenticated') order by table_name,column_name,grantee,privilege_type;
select pg_get_userbyid(member) as member_role,pg_get_userbyid(roleid) as inherited_role from pg_auth_members;
select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as security_definer,p.proconfig,p.proacl
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname;
