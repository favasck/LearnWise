-- Apply AFTER scoped_team_permissions.sql and role_rpc_privileges.sql.
-- Applied through Supabase as 20261115083038_tutor_availability_booking_requests.
create table public.tutor_availability (
 id uuid primary key default gen_random_uuid(), tutor_id uuid not null references public.tutors(id),
 starts_at timestamptz not null, ends_at timestamptz not null,
 mode text not null check(mode in ('Online','Offline')), area text not null default '',
 buffer_min int not null default 30 check(buffer_min between 0 and 180),
 published boolean not null default true, created_at timestamptz not null default now(),
 check(ends_at>starts_at and ends_at<=starts_at+interval '24 hours'), check(mode='Online' or length(trim(area))>0)
);
create index on public.tutor_availability(tutor_id,starts_at);
create table public.booking_requests (
 id uuid primary key default gen_random_uuid(), tutor_id uuid not null references public.tutors(id),
 student_id uuid not null references public.students(id), availability_id uuid references public.tutor_availability(id),
 requested_by uuid not null references auth.users(id), preferred_times timestamptz[] not null,
 scheduled_at timestamptz not null, duration_min int not null check(duration_min between 15 and 240),
 subject text not null check(length(trim(subject)) between 1 and 120),
 mode text not null check(mode in ('Online','Offline')), location text not null default '',
 notes text not null default '', response_note text not null default '',
 buffer_min int not null default 30 check(buffer_min between 0 and 180),
 status text not null default 'Pending' check(status in ('Pending','Proposed','Confirmed','Declined','Withdrawn')),
 class_id uuid unique references public.classes(id), version int not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(cardinality(preferred_times) between 1 and 3), check(mode='Online' or length(trim(location))>0)
);
create index on public.booking_requests(tutor_id,status);
create index on public.booking_requests(student_id);
create table public.booking_events (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.booking_requests(id),
 actor_id uuid not null references auth.users(id), status text not null, scheduled_at timestamptz not null,
 note text not null default '', created_at timestamptz not null default clock_timestamp()
);
create index on public.booking_events(request_id);
alter table public.classes add column travel_buffer_min int not null default 30 check(travel_buffer_min between 0 and 180);

-- Private predicates inspect relationships without exposing other families' schedules.
create function learnwise_private.booking_assignment(tid uuid,sid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.student_tutors st join public.students s on s.id=st.student_id
 join public.tutors t on t.id=st.tutor_id where st.tutor_id=tid and st.student_id=sid and st.is_active
 and st.deleted_at is null and s.deleted_at is null and t.deleted_at is null and t.status='Active' and s.status='Active')
$$;
create function learnwise_private.booking_tutor(tid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(learnwise_private.tutor_scope(tid),false) and exists(select 1 from public.tutors t
 where t.id=tid and t.deleted_at is null and t.status='Active')
$$;
alter table public.tutor_availability enable row level security;
alter table public.booking_requests enable row level security;
alter table public.booking_events enable row level security;
create policy availability_read on public.tutor_availability for select to authenticated using (
 learnwise_private.booking_tutor(tutor_id) or (published and exists(select 1 from public.students s
 where learnwise_private.family_student(s.id) and learnwise_private.booking_assignment(tutor_id,s.id))));
create policy availability_write on public.tutor_availability for all to authenticated
 using(learnwise_private.booking_tutor(tutor_id)) with check(learnwise_private.booking_tutor(tutor_id));
create policy booking_read on public.booking_requests for select to authenticated using(
 learnwise_private.booking_tutor(tutor_id) or learnwise_private.family_student(student_id));
create policy booking_events_read on public.booking_events for select to authenticated using(
 exists(select 1 from public.booking_requests r where r.id=request_id));
revoke all on public.tutor_availability,public.booking_requests,public.booking_events from public,anon,authenticated;
grant select,insert,update on public.tutor_availability to authenticated;
grant select on public.booking_requests, public.booking_events to authenticated;
revoke all on public.tutor_availability,public.booking_requests,public.booking_events from anon;

-- Protect every scheduling path, including existing admin class forms. The lock is
-- transaction-scoped and global so concurrent tutor AND student conflicts serialize.
create function learnwise_private.booking_class_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.classes; gap int;
begin
 perform pg_advisory_xact_lock(714602);
 if tg_op='UPDATE' and (to_jsonb(new)-array['status','attendance','updated_at','edited_at','edited_by']) =
 (to_jsonb(old)-array['status','attendance','updated_at','edited_at','edited_by'])
 and old.status not in ('Cancelled','Rescheduled') then return new; end if;
 if new.deleted_at is not null or new.status in ('Cancelled','Rescheduled') then return new; end if;
 if new.duration_min not between 15 and 240 then raise exception 'Class duration must be 15–240 minutes'; end if;
 for c in select * from public.classes where id<>new.id and deleted_at is null
 and status not in ('Cancelled','Rescheduled') and (tutor_id=new.tutor_id or student_id=new.student_id) loop
   gap:=case when c.tutor_id=new.tutor_id and (c.mode='Offline' or new.mode='Offline')
     and not(c.mode='Offline' and new.mode='Offline' and lower(trim(coalesce(c.location,'')))=lower(trim(coalesce(new.location,''))) and length(trim(coalesce(new.location,'')))>0)
     then greatest(c.travel_buffer_min,new.travel_buffer_min) else 0 end;
   if new.scheduled_at<c.scheduled_at+make_interval(mins=>c.duration_min+gap)
   and c.scheduled_at<new.scheduled_at+make_interval(mins=>new.duration_min+gap) then
     raise exception 'Time conflicts with an existing class or travel buffer. Choose another time.';
   end if;
 end loop;
 return new;
end $$;
create trigger booking_schedule_guard before insert or update of scheduled_at,duration_min,tutor_id,student_id,status,deleted_at,location,mode,travel_buffer_min
on public.classes for each row execute function learnwise_private.booking_class_guard();

create function learnwise_private.booking_submit(payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare tid uuid:=(payload->>'tutor_id')::uuid; sid uuid:=(payload->>'student_id')::uuid;
 aid uuid:=nullif(payload->>'availability_id','')::uuid; times timestamptz[]; a public.tutor_availability;
 rid uuid; duration int:=(payload->>'duration_min')::int; mode_value text:=payload->>'mode';
begin
 if auth.uid() is null or not learnwise_private.family_student(sid) or not learnwise_private.booking_assignment(tid,sid) then raise exception 'Not authorized for this student and tutor'; end if;
 select array_agg(value::timestamptz order by ord) into times from jsonb_array_elements_text(payload->'preferred_times') with ordinality as x(value,ord);
 if cardinality(times) is null or cardinality(times) not between 1 and 3 or exists(select 1 from unnest(times) t where t is null or t<=now() or t>now()+interval '180 days') then raise exception 'Choose 1–3 future times within 180 days'; end if;
 if aid is not null then
   select * into a from public.tutor_availability where id=aid for share;
   if not found or not a.published or a.tutor_id<>tid or a.mode<>mode_value then raise exception 'Availability has changed. Refresh and try again.'; end if;
   if exists(select 1 from unnest(times) t where t<a.starts_at or t+make_interval(mins=>duration)>a.ends_at) then raise exception 'Requested times must fit the availability window'; end if;
 end if;
 if length(coalesce(payload->>'notes',''))>2000 or length(coalesce(payload->>'location',''))>500 then raise exception 'Notes or location are too long'; end if;
 insert into public.booking_requests(tutor_id,student_id,availability_id,requested_by,preferred_times,scheduled_at,duration_min,subject,mode,location,notes,buffer_min)
 values(tid,sid,aid,auth.uid(),times,times[1],duration,trim(payload->>'subject'),mode_value,trim(coalesce(payload->>'location','')),coalesce(payload->>'notes',''),coalesce(a.buffer_min,30)) returning id into rid;
 insert into public.booking_events(request_id,actor_id,status,scheduled_at,note) values(rid,auth.uid(),'Pending',times[1],coalesce(payload->>'notes',''));
 return rid;
end $$;

create function learnwise_private.booking_respond(rid uuid,expected_version int,action text,new_time timestamptz,note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.booking_requests; manager boolean; family boolean; cid uuid; tutor_user uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into r from public.booking_requests where id=rid for update;
 if not found then raise exception 'Request unavailable'; end if;
 manager:=learnwise_private.booking_tutor(r.tutor_id); family:=learnwise_private.family_student(r.student_id);
 if not manager and not family then raise exception 'Not authorized'; end if;
 if r.version<>expected_version then raise exception 'Request changed. Refresh before responding.'; end if;
 if r.status not in ('Pending','Proposed') then raise exception 'Request has already been resolved'; end if;
 if length(coalesce(note,''))>2000 then raise exception 'Response is too long'; end if;
 if action='withdraw' and family then r.status:='Withdrawn';
 elsif action='decline' and manager then r.status:='Declined';
 elsif action='propose' and manager then
   if new_time is null or new_time<=now() or new_time>now()+interval '180 days' then raise exception 'Choose a future alternative within 180 days'; end if;
   r.status:='Proposed'; r.scheduled_at:=new_time;
 elsif (action='confirm' and manager and r.status='Pending') or (action='accept' and family and r.status='Proposed') then
   if r.scheduled_at<=now() or not learnwise_private.booking_assignment(r.tutor_id,r.student_id) then raise exception 'Time or assignment is no longer available'; end if;
   if r.availability_id is not null and r.status='Pending' and not exists(select 1 from public.tutor_availability a where a.id=r.availability_id and a.published and a.tutor_id=r.tutor_id and a.mode=r.mode and r.scheduled_at>=a.starts_at and r.scheduled_at+make_interval(mins=>r.duration_min)<=a.ends_at) then raise exception 'Availability changed. Propose another time.'; end if;
   select user_id into tutor_user from public.tutors where id=r.tutor_id;
   insert into public.classes(student_id,tutor_id,subject,scheduled_at,duration_min,mode,location,travel_buffer_min,owner_user_id)
   values(r.student_id,r.tutor_id,r.subject,r.scheduled_at,r.duration_min,r.mode,nullif(r.location,''),r.buffer_min,tutor_user) returning id into cid;
   r.status:='Confirmed'; r.class_id:=cid;
 else raise exception 'This action is not allowed'; end if;
 update public.booking_requests set status=r.status,scheduled_at=r.scheduled_at,class_id=r.class_id,response_note=coalesce(note,''),version=version+1,updated_at=clock_timestamp() where id=rid;
 insert into public.booking_events(request_id,actor_id,status,scheduled_at,note) values(rid,auth.uid(),r.status,r.scheduled_at,coalesce(note,''));
 return rid;
end $$;

create function public.submit_booking_request(payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select learnwise_private.booking_submit(payload) $$;
create function public.respond_booking_request(rid uuid,expected_version int,action text,new_time timestamptz default null,note text default '') returns uuid language sql security invoker set search_path='' as $$ select learnwise_private.booking_respond(rid,expected_version,action,new_time,note) $$;
-- Explicit grants: privileged code is private, with checked public invoker wrappers.
revoke all on function public.submit_booking_request(jsonb),public.respond_booking_request(uuid,int,text,timestamptz,text) from public,anon;
grant execute on function public.submit_booking_request(jsonb),public.respond_booking_request(uuid,int,text,timestamptz,text) to authenticated;
revoke all on function learnwise_private.booking_submit(jsonb),learnwise_private.booking_respond(uuid,int,text,timestamptz,text),learnwise_private.booking_assignment(uuid,uuid),learnwise_private.booking_tutor(uuid),learnwise_private.booking_class_guard() from public,anon;
grant execute on function learnwise_private.booking_submit(jsonb),learnwise_private.booking_respond(uuid,int,text,timestamptz,text),learnwise_private.booking_assignment(uuid,uuid),learnwise_private.booking_tutor(uuid) to authenticated;
create trigger booking_availability_audit after insert or update on public.tutor_availability for each row execute function learnwise_private.audit_record();

-- Return only free instants; never expose class identities, locations or busy rows.
create function learnwise_private.booking_slots(aid uuid,sid uuid,duration int,loc text) returns timestamptz[]
language plpgsql stable security definer set search_path='' as $$
declare a public.tutor_availability; result timestamptz[];
begin
 select * into a from public.tutor_availability where id=aid and published;
 if auth.uid() is null or a.id is null or not learnwise_private.family_student(sid) or not learnwise_private.booking_assignment(a.tutor_id,sid) then raise exception 'Availability unavailable'; end if;
 if duration is null or duration not between 15 and 240 then raise exception 'Invalid duration'; end if;
 select coalesce(array_agg(slot order by slot),'{}'::timestamptz[]) into result
 from generate_series(a.starts_at,a.ends_at-make_interval(mins=>duration),interval '15 minutes') slot
 where slot>now() and slot<=now()+interval '180 days' and not exists(
 select 1 from public.classes c where c.deleted_at is null and c.status not in ('Cancelled','Rescheduled')
 and (c.tutor_id=a.tutor_id or c.student_id=sid)
 and slot<c.scheduled_at+make_interval(mins=>c.duration_min+case when c.tutor_id=a.tutor_id and (c.mode='Offline' or a.mode='Offline')
 and not(c.mode='Offline' and a.mode='Offline' and lower(trim(coalesce(c.location,'')))=lower(trim(coalesce(loc,''))) and length(trim(coalesce(loc,'')))>0)
 then greatest(c.travel_buffer_min,a.buffer_min) else 0 end)
 and c.scheduled_at<slot+make_interval(mins=>duration+case when c.tutor_id=a.tutor_id and (c.mode='Offline' or a.mode='Offline')
 and not(c.mode='Offline' and a.mode='Offline' and lower(trim(coalesce(c.location,'')))=lower(trim(coalesce(loc,''))) and length(trim(coalesce(loc,'')))>0)
 then greatest(c.travel_buffer_min,a.buffer_min) else 0 end));
 return result;
end $$;
create function public.booking_slots(aid uuid,sid uuid,duration int,loc text default '') returns timestamptz[]
language sql security invoker set search_path='' as $$ select learnwise_private.booking_slots(aid,sid,duration,loc) $$;
revoke all on function public.booking_slots(uuid,uuid,int,text),learnwise_private.booking_slots(uuid,uuid,int,text) from public,anon;
grant execute on function public.booking_slots(uuid,uuid,int,text),learnwise_private.booking_slots(uuid,uuid,int,text) to authenticated;
