-- Forward migration after scoped teams and recurring_booking_review.sql.
-- Official factual catalogue lives in src/data/masterCalendarDates.json; this
-- table stores tutor-authored events and retained overrides/removals of it.
create table public.calendar_entries (
 id uuid primary key default gen_random_uuid(), catalog_key text unique check(length(catalog_key) between 1 and 200),
 owner_user_id uuid not null default auth.uid() references auth.users(id),
 title text not null check(length(trim(title)) between 1 and 220),
 category text not null check(category in ('Exam','QatarHoliday','Task','Other')),
 visibility text not null default 'shared' check(visibility in ('shared','private')),
 starts_on date not null, ends_on date not null, all_day boolean not null default true,
 starts_at timestamptz, duration_min int check(duration_min between 1 and 1440),
 board text not null default '' check(length(board)<=100), syllabus text not null default '' check(length(syllabus)<=40),
 paper text not null default '' check(length(paper)<=40), zone text not null default '' check(length(zone)<=100),
 series text not null default '' check(length(series)<=100), session_label text not null default '' check(length(session_label)<=100),
 source_url text not null default '' check(source_url='' or source_url ~ '^https://[^[:space:]]+$'),
 verification text not null default 'Tutor entered' check(verification in ('Tutor entered','Provisional','Centre confirmed')),
 notes text not null default '' check(length(notes)<=3000), task_status text not null default 'Open' check(task_status in ('Open','Done')),
 version int not null default 1, created_at timestamptz not null default now(), edited_at timestamptz,
 edited_by uuid references auth.users(id), deleted_at timestamptz,
 check(ends_on>=starts_on and ends_on<=starts_on+366),
 check(all_day or (starts_at is not null and duration_min is not null and (starts_at at time zone 'Asia/Qatar')::date=starts_on
 and ((starts_at+make_interval(mins=>duration_min)-interval '1 millisecond') at time zone 'Asia/Qatar')::date=ends_on)),
 check(catalog_key is null or visibility='shared')
);
create index calendar_entries_date_idx on public.calendar_entries(starts_on,ends_on);
create index calendar_entries_owner_idx on public.calendar_entries(owner_user_id);
alter table public.calendar_entries enable row level security;
create policy calendar_read on public.calendar_entries for select to authenticated using(
 learnwise_private.actor_role() is not null and (visibility='shared' or owner_user_id=(select auth.uid()) or learnwise_private.is_root()));
create policy calendar_create on public.calendar_entries for insert to authenticated with check(
 learnwise_private.actor_role() in ('tutor','admin_tutor','super_admin','admin') and owner_user_id=(select auth.uid()));
create policy calendar_edit on public.calendar_entries for update to authenticated using(
 learnwise_private.actor_role() in ('tutor','admin_tutor','super_admin','admin') and
 (visibility='shared' or owner_user_id=(select auth.uid()) or learnwise_private.is_root())) with check(
 learnwise_private.actor_role() in ('tutor','admin_tutor','super_admin','admin') and
 (visibility='shared' or owner_user_id=(select auth.uid()) or learnwise_private.is_root()));
revoke all on public.calendar_entries from public,anon,authenticated;
grant select on public.calendar_entries to authenticated;
grant insert(catalog_key,title,category,visibility,starts_on,ends_on,all_day,starts_at,duration_min,board,syllabus,paper,zone,series,session_label,source_url,verification,notes,task_status,deleted_at),
 update(title,category,visibility,starts_on,ends_on,all_day,starts_at,duration_min,board,syllabus,paper,zone,series,session_label,source_url,verification,notes,task_status,deleted_at)
 on public.calendar_entries to authenticated;
create function learnwise_private.calendar_entry_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if old.visibility is distinct from new.visibility and old.owner_user_id<>auth.uid() and not learnwise_private.is_root() then raise exception 'Only the author can change calendar visibility'; end if;
   new.version:=old.version+1;new.edited_at:=clock_timestamp();new.edited_by:=auth.uid();
 end if;
 return new;
end $$;
revoke all on function learnwise_private.calendar_entry_guard() from public,anon,authenticated;
create trigger calendar_entry_guard before update on public.calendar_entries for each row execute function learnwise_private.calendar_entry_guard();
create trigger calendar_entry_audit after insert or update on public.calendar_entries for each row execute function learnwise_private.audit_record();
