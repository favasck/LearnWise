-- Keep privileged implementations outside exposed API schemas.
do $$ declare signature text; definition text; begin
 foreach signature in array array['admin_update_profile(uuid,jsonb)','next_invoice_number()'] loop
  if not (select prosecdef from pg_proc where oid=('public.'||signature)::regprocedure) then continue; end if;
   select pg_get_functiondef(('public.'||signature)::regprocedure) into definition;
   definition:=replace(definition,'FUNCTION public.','FUNCTION learnwise_private.');
   execute definition;
 end loop;
end $$;
create or replace function public.admin_update_profile(p_user_id uuid,p_updates jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select learnwise_private.admin_update_profile(p_user_id,p_updates) $$;
create or replace function public.next_invoice_number() returns text
language sql security invoker set search_path='' as $$ select learnwise_private.next_invoice_number() $$;
revoke all on function learnwise_private.admin_update_profile(uuid,jsonb),learnwise_private.next_invoice_number() from public,anon;
grant execute on function learnwise_private.admin_update_profile(uuid,jsonb),learnwise_private.next_invoice_number() to authenticated;
do $$ declare signature text; begin
 for signature in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('get_my_role','is_admin','is_super_admin','is_admin_tutor','is_staff','can_manage_academic','can_manage_payments') loop
   execute 'alter function '||signature||' security invoker';
   execute 'revoke all on function '||signature||' from public,anon';
   execute 'grant execute on function '||signature||' to authenticated';
 end loop;
end $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
alter function public.set_updated_at() set search_path='';
