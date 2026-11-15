-- Apply after scoped_team_permissions.sql. Existing family links are never inferred or replaced.
begin;
alter table public.parents add column if not exists is_placeholder boolean not null default false;

create or replace function learnwise_private.parent_actual_name() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.full_name is distinct from old.full_name and new.full_name !~* '^Parent of ' then
    new.is_placeholder:=false;
  end if;
  return new;
end $$;
revoke all on function learnwise_private.parent_actual_name() from public,anon,authenticated;
drop trigger if exists zz_parent_actual_name on public.parents;
create trigger zz_parent_actual_name before update of full_name on public.parents
for each row execute function learnwise_private.parent_actual_name();

create or replace function learnwise_private.ensure_student_parent() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.parent_id is null and new.deleted_at is null then
    insert into public.parents(full_name,owner_user_id,is_placeholder)
    values ('Parent of ' || new.full_name,
      case when current_user in ('authenticated','anon') then auth.uid() else new.owner_user_id end,
      true)
    returning id into new.parent_id;
  end if;
  return new;
end $$;
revoke all on function learnwise_private.ensure_student_parent() from public,anon,authenticated;
-- Runs after scoped_guard: existing ownership, role and relationship guards remain in force.
drop trigger if exists zz_ensure_student_parent on public.students;
create trigger zz_ensure_student_parent before insert or update of parent_id on public.students
for each row execute function learnwise_private.ensure_student_parent();

-- Row locks and the trigger make the backfill atomic and safe to replay.
update public.students set parent_id=null where parent_id is null and deleted_at is null;
commit;
