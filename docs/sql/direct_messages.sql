-- Run once in the LearnWise Supabase SQL editor after the bootstrap schema.
begin;
create schema if not exists learnwise_private;
revoke all on schema learnwise_private from public, anon;
grant usage on schema learnwise_private to authenticated;

create table public.direct_messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.profiles(id),
 recipient_id uuid not null references public.profiles(id),
 body text not null check (length(btrim(body)) between 1 and 4000),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 check (sender_id <> recipient_id)
);
create index direct_messages_sender_time on public.direct_messages(sender_id,created_at desc,id desc);
create index direct_messages_recipient_time on public.direct_messages(recipient_id,created_at desc,id desc);
create index direct_messages_unread on public.direct_messages(recipient_id,sender_id) where read_at is null;
alter table public.direct_messages enable row level security;
revoke all on public.direct_messages from public,anon,authenticated;
grant select on public.direct_messages to authenticated;
grant insert(id,sender_id,recipient_id,body) on public.direct_messages to authenticated;
grant update(read_at) on public.direct_messages to authenticated;

-- Internal lookups need definer privileges because profiles are otherwise scoped
-- to the current account. Only names/roles are exposed, never contact details.
create function learnwise_private.messaging_active(uid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles
 where id=uid and status='Active' and role in ('admin','super_admin','admin_tutor','tutor','parent','student'));
$$;
revoke all on function learnwise_private.messaging_active(uuid) from public,anon;
grant execute on function learnwise_private.messaging_active(uuid) to authenticated;

create policy message_read on public.direct_messages for select to authenticated
 using (learnwise_private.messaging_active((select auth.uid())) and ((select auth.uid())=sender_id or (select auth.uid())=recipient_id));
create policy message_send on public.direct_messages for insert to authenticated
 with check ((select auth.uid())=sender_id and learnwise_private.messaging_active((select auth.uid())) and learnwise_private.messaging_active(recipient_id));
create policy message_receipt on public.direct_messages for update to authenticated
 using ((select auth.uid())=recipient_id and learnwise_private.messaging_active((select auth.uid())))
 with check ((select auth.uid())=recipient_id and learnwise_private.messaging_active((select auth.uid())));

create function learnwise_private.message_contacts() returns table(id uuid,full_name text,role text)
language sql stable security definer set search_path='' as $$
 select p.id,p.full_name,p.role from public.profiles p
 where learnwise_private.messaging_active(auth.uid()) and p.id<>auth.uid()
 and p.status='Active' and p.role in ('admin','super_admin','admin_tutor','tutor','parent','student')
 order by p.full_name,p.id;
$$;
revoke all on function learnwise_private.message_contacts() from public,anon;
grant execute on function learnwise_private.message_contacts() to authenticated;
create function public.message_contacts() returns table(id uuid,full_name text,role text)
language sql stable security invoker set search_path='' as $$ select * from learnwise_private.message_contacts(); $$;
revoke all on function public.message_contacts() from public,anon;
grant execute on function public.message_contacts() to authenticated;

create function learnwise_private.message_inbox() returns table(peer_id uuid,full_name text,role text,body text,created_at timestamptz,unread bigint)
language sql stable security definer set search_path='' as $$
 with mine as (
 select m.*,case when m.sender_id=auth.uid() then m.recipient_id else m.sender_id end peer
 from public.direct_messages m where learnwise_private.messaging_active(auth.uid())
 and (m.sender_id=auth.uid() or m.recipient_id=auth.uid())
 ), latest as (select distinct on(peer) * from mine order by peer,created_at desc,id desc),
 counts as (select peer,count(*) total from mine where recipient_id=auth.uid() and read_at is null group by peer)
 select l.peer,p.full_name,p.role,l.body,l.created_at,coalesce(c.total,0)
 from latest l join public.profiles p on p.id=l.peer left join counts c on c.peer=l.peer
 order by l.created_at desc,l.id desc;
$$;
revoke all on function learnwise_private.message_inbox() from public,anon;
grant execute on function learnwise_private.message_inbox() to authenticated;
create function public.message_inbox() returns table(peer_id uuid,full_name text,role text,body text,created_at timestamptz,unread bigint)
language sql stable security invoker set search_path='' as $$ select * from learnwise_private.message_inbox(); $$;
revoke all on function public.message_inbox() from public,anon;
grant execute on function public.message_inbox() to authenticated;
commit;
