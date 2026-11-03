-- Local candidate: review grants and existing audit objects before deployment.
-- Does not map roles or promote any account. Requires the baseline profiles schema.
begin;

-- Fail closed if an incompatible preexisting audit table exists; do not mask drift.
create table public.permission_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  actor_role text not null,
  action text not null check (action = 'profile_permissions_changed'),
  target_user_id uuid not null,
  changes jsonb not null,
  occurred_at timestamptz not null default now()
);
alter table public.permission_audit_events enable row level security;
revoke all on public.permission_audit_events from public, anon, authenticated;
grant select on public.permission_audit_events to authenticated;
create policy permission_audit_admin_read on public.permission_audit_events
  for select to authenticated using (
    exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.status = 'Active')
  );

-- Row policies do not protect columns. Remove table AND existing column UPDATE
-- grants, including grants inherited through PUBLIC. Keep existing RLS enabled.
revoke update on public.profiles from public, anon, authenticated;
do $$
declare columns_sql text;
begin
  select string_agg(quote_ident(attname), ', ') into columns_sql
    from pg_attribute
    where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped;
  execute 'revoke update (' || columns_sql || ') on public.profiles from public, anon, authenticated';
end;
$$;
grant update (full_name, phone) on public.profiles to authenticated;

-- Existing frontend uses only role/status here. Definer privileges are scoped by
-- the actor's current persisted role/status, never user metadata or request role.
create function public.admin_update_profile(p_user_id uuid, p_updates jsonb)
returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  previous public.profiles;
  updated public.profiles;
begin
  select * into actor from public.profiles where id = auth.uid() for update;
  if actor.id is null or actor.role <> 'admin' or actor.status <> 'Active' then
    raise exception 'Active administrator required' using errcode = '42501';
  end if;
  if p_updates is null or jsonb_typeof(p_updates) <> 'object'
      or p_updates = '{}'::jsonb then
    raise exception 'Nonempty update object required' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_updates) k
      where k not in ('role', 'status')) then
    raise exception 'Only role and status may be changed' using errcode = '22023';
  end if;
  if p_user_id = actor.id then
    raise exception 'Administrators cannot change their own permissions' using errcode = '42501';
  end if;
  select * into previous from public.profiles where id = p_user_id for update;
  if previous.id is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  update public.profiles set
    role = case when p_updates ? 'role' then p_updates->>'role' else role end,
    status = case when p_updates ? 'status' then p_updates->>'status' else status end
    where id = p_user_id returning * into updated;
  insert into public.permission_audit_events
    (actor_user_id, actor_role, action, target_user_id, changes)
  values (actor.id, actor.role, 'profile_permissions_changed', updated.id,
    jsonb_build_object('old', jsonb_build_object('role', previous.role, 'status', previous.status),
                       'new', jsonb_build_object('role', updated.role, 'status', updated.status)));
  return updated;
end;
$$;
revoke all on function public.admin_update_profile(uuid, jsonb) from public, anon;
grant execute on function public.admin_update_profile(uuid, jsonb) to authenticated;
commit;
