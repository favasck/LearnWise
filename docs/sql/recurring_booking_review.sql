-- Forward migration after booking_requests.sql. Existing requests remain one-time.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.tutor_availability'::regclass and contype='c'
 and (pg_get_constraintdef(oid) like '%area%' or pg_get_constraintdef(oid) like '%mode%') loop
 execute format('alter table public.tutor_availability drop constraint %I',c.conname); end loop;
end $$;
alter table public.tutor_availability add constraint availability_mode_v2 check(mode in ('Online','Offline','Either'));
alter table public.booking_requests add column student_name text not null default '',
 add column student_details text not null default '',
 add column recurrence jsonb not null default '{"frequency":"once","weekdays":[],"count":1}',
 add column occurrence_times timestamptz[] not null default '{}';
update public.booking_requests r set student_name=s.full_name,occurrence_times=array[r.scheduled_at]
 from public.students s where s.id=r.student_id;
alter table public.booking_events add column details jsonb not null default '{}';
alter table public.classes add column booking_request_id uuid references public.booking_requests(id);
create unique index classes_booking_occurrence_idx on public.classes(booking_request_id,scheduled_at) where booking_request_id is not null;

create table public.student_exams(
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id),
 title text not null check(length(trim(title)) between 1 and 160),
 scheduled_at timestamptz not null,duration_min int not null default 60 check(duration_min between 15 and 480),
 notes text not null default '' check(length(notes)<=2000), created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),deleted_at timestamptz
);
create index on public.student_exams(student_id,scheduled_at) where deleted_at is null;
alter table public.student_exams enable row level security;
create policy exams_read on public.student_exams for select to authenticated using(learnwise_private.student_scope(student_id));
create policy exams_add on public.student_exams for insert to authenticated with check(learnwise_private.student_scope(student_id) and created_by=auth.uid());
create policy exams_edit on public.student_exams for update to authenticated using(learnwise_private.student_scope(student_id) and deleted_at is null)
 with check(learnwise_private.student_scope(student_id));
revoke all on public.student_exams from public,anon,authenticated;
grant select on public.student_exams to authenticated;
grant insert(student_id,title,scheduled_at,duration_min,notes),update(title,scheduled_at,duration_min,notes,deleted_at) on public.student_exams to authenticated;
create trigger booking_exam_audit after insert or update on public.student_exams for each row execute function learnwise_private.audit_record();

create function learnwise_private.booking_occurrences(first_at timestamptz,rule jsonb) returns timestamptz[]
language plpgsql immutable set search_path='' as $$
declare frequency text:=coalesce(rule->>'frequency','once'); total int; days int[];
 anchor timestamp:=first_at at time zone 'Asia/Qatar'; d timestamp; result timestamptz[]:='{}'; offset_days int;
begin
 if first_at is null then raise exception 'Choose the first session date and time'; end if;
 if frequency='once' then return array[first_at]; end if;
 if frequency not in ('weekly','twice_weekly','fortnightly','monthly') then raise exception 'Invalid repeat option'; end if;
 total:=(rule->>'count')::int;
 if total is null or total not between 2 and 24 then raise exception 'Choose 2–24 sessions'; end if;
 select array_agg(distinct value::int order by value::int) into days from jsonb_array_elements_text(coalesce(rule->'weekdays','[]'));
 if frequency<>'monthly' and (cardinality(days) is null or cardinality(days)<>case when frequency='twice_weekly' then 2 else 1 end
 or exists(select 1 from unnest(days) x where x is null or x not between 0 and 6) or not extract(dow from anchor)::int=any(days)) then
 raise exception 'Select the repeat weekdays, including the first session day'; end if;
 for offset_days in 0..366 loop
   d:=anchor+make_interval(days=>offset_days);
   if (frequency='monthly' and extract(day from d)=least(extract(day from anchor),extract(day from date_trunc('month',d)+interval '1 month -1 day'))) or
   (frequency<>'monthly' and extract(dow from d)::int=any(days) and
   (frequency<>'fortnightly' or ((offset_days+extract(dow from anchor)::int)/7)%2=0)) then
     result:=array_append(result,d at time zone 'Asia/Qatar');
   end if;
   exit when cardinality(result)=total;
 end loop;
 if cardinality(result)<>total then raise exception 'Choose fewer sessions to stay within one year'; end if;
 return result;
end $$;

-- Snapshot details are immutable to clients and preserved for every response.
create function learnwise_private.booking_snapshot(r public.booking_requests) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('duration_min',r.duration_min,'mode',r.mode,'location',r.location,'recurrence',r.recurrence,
 'occurrence_times',r.occurrence_times,'student_name',r.student_name,'student_details',r.student_details)
$$;

create or replace function learnwise_private.booking_submit(payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare tid uuid:=(payload->>'tutor_id')::uuid; sid uuid:=(payload->>'student_id')::uuid;
 aid uuid:=nullif(payload->>'availability_id','')::uuid; times timestamptz[]; a public.tutor_availability;
 r public.booking_requests; duration int:=(payload->>'duration_min')::int; mode_value text:=payload->>'mode';
 rule jsonb:=coalesce(payload->'recurrence','{"frequency":"once","weekdays":[],"count":1}'::jsonb); occurrences timestamptz[]; name_value text;
begin
 if auth.uid() is null or not learnwise_private.family_student(sid) or not learnwise_private.booking_assignment(tid,sid) then raise exception 'Not authorized for this student and tutor'; end if;
 if duration is null or duration<>all(array[60,90,120,150,180]) then raise exception 'Choose 1, 1.5, 2, 2.5 or 3 hours'; end if;
 select array_agg(value::timestamptz order by ord) into times from jsonb_array_elements_text(payload->'preferred_times') with ordinality as x(value,ord);
 if cardinality(times) is null or cardinality(times) not between 1 and 3 or exists(select 1 from unnest(times) t where t is null or t<=now() or t>now()+interval '180 days') then raise exception 'Choose 1–3 future times within 180 days'; end if;
 occurrences:=learnwise_private.booking_occurrences(times[1],rule);
 if aid is not null then
   select * into a from public.tutor_availability where id=aid for share;
   if not found or not a.published or a.tutor_id<>tid or (a.mode<>'Either' and a.mode<>mode_value) then raise exception 'Availability has changed. Refresh and try again.'; end if;
   if exists(select 1 from unnest(times) t where t<a.starts_at or t+make_interval(mins=>duration)>a.ends_at) then raise exception 'Requested first-session times must fit the availability window'; end if;
 end if;
 select coalesce(nullif(trim(payload->>'student_name'),''),full_name) into name_value from public.students where id=sid;
 if length(name_value)>160 or length(coalesce(payload->>'student_details',''))>2000 or length(coalesce(payload->>'notes',''))>2000 or length(coalesce(payload->>'location',''))>500 then raise exception 'Student details, notes or location are too long'; end if;
 insert into public.booking_requests(tutor_id,student_id,availability_id,requested_by,preferred_times,scheduled_at,duration_min,subject,mode,location,notes,buffer_min,student_name,student_details,recurrence,occurrence_times)
 values(tid,sid,aid,auth.uid(),times,times[1],duration,trim(payload->>'subject'),mode_value,trim(coalesce(payload->>'location','')),coalesce(payload->>'notes',''),coalesce(a.buffer_min,30),name_value,coalesce(payload->>'student_details',''),rule,occurrences) returning * into r;
 insert into public.booking_events(request_id,actor_id,status,scheduled_at,note,details) values(r.id,auth.uid(),'Pending',times[1],r.notes,learnwise_private.booking_snapshot(r));
 return r.id;
end $$;

create function learnwise_private.booking_review(rid uuid,expected_version int,action text,changes jsonb,note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.booking_requests; manager boolean; family boolean; cid uuid; first_cid uuid; tutor_user uuid; occurrence timestamptz; a public.tutor_availability;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into r from public.booking_requests where id=rid for update;
 if not found then raise exception 'Request unavailable'; end if;
 manager:=learnwise_private.booking_tutor(r.tutor_id); family:=learnwise_private.family_student(r.student_id);
 if not manager and not family then raise exception 'Not authorized'; end if;
 if r.version<>expected_version then raise exception 'Request changed. Refresh before responding.'; end if;
 if r.status not in ('Pending','Proposed') then raise exception 'Request has already been resolved'; end if;
 if length(coalesce(note,''))>2000 then raise exception 'Response is too long'; end if;
 if action<>'propose' and coalesce(changes,'{}')<>'{}'::jsonb then raise exception 'Changed details must be sent as a proposal'; end if;
 if action='withdraw' and family then r.status:='Withdrawn';
 elsif action='decline' and manager then r.status:='Declined';
 elsif action='propose' and manager then
   if exists(select 1 from jsonb_object_keys(changes) k where k<>all(array['scheduled_at','duration_min','mode','location','recurrence'])) then raise exception 'Unsupported proposal field'; end if;
   r.scheduled_at:=coalesce((changes->>'scheduled_at')::timestamptz,r.scheduled_at);
   r.duration_min:=coalesce((changes->>'duration_min')::int,r.duration_min);
   r.mode:=coalesce(changes->>'mode',r.mode); r.location:=coalesce(changes->>'location',r.location);
   r.recurrence:=coalesce(changes->'recurrence',r.recurrence);
   if r.scheduled_at<=now() or r.scheduled_at>now()+interval '180 days' then raise exception 'Choose a future alternative within 180 days'; end if;
   if r.duration_min<>all(array[60,90,120,150,180]) or r.mode not in ('Online','Offline') or (r.mode='Offline' and length(trim(r.location))=0) or length(r.location)>500 then raise exception 'Choose a valid duration, mode and location'; end if;
   r.occurrence_times:=learnwise_private.booking_occurrences(r.scheduled_at,r.recurrence);
   r.status:='Proposed';
 elsif (action='confirm' and manager and r.status='Pending') or (action='accept' and family and r.status='Proposed') then
   if r.scheduled_at<=now() or not learnwise_private.booking_assignment(r.tutor_id,r.student_id) then raise exception 'Time or assignment is no longer available'; end if;
   if r.availability_id is not null and r.status='Pending' then
     select * into a from public.tutor_availability where id=r.availability_id for share;
     if not found or not a.published or a.tutor_id<>r.tutor_id or (a.mode<>'Either' and a.mode<>r.mode) or r.scheduled_at<a.starts_at or r.scheduled_at+make_interval(mins=>r.duration_min)>a.ends_at then raise exception 'Availability changed. Propose another time.'; end if;
   end if;
   r.occurrence_times:=learnwise_private.booking_occurrences(r.scheduled_at,r.recurrence);
   select user_id into tutor_user from public.tutors where id=r.tutor_id;
   -- One transaction: any later occurrence conflict rolls back the entire series.
   foreach occurrence in array r.occurrence_times loop
     insert into public.classes(student_id,tutor_id,subject,scheduled_at,duration_min,mode,location,travel_buffer_min,owner_user_id,booking_request_id)
     values(r.student_id,r.tutor_id,r.subject,occurrence,r.duration_min,r.mode,nullif(r.location,''),r.buffer_min,tutor_user,r.id) returning id into cid;
     first_cid:=coalesce(first_cid,cid);
   end loop;
   r.status:='Confirmed'; r.class_id:=first_cid;
 else raise exception 'This action is not allowed'; end if;
 update public.booking_requests set status=r.status,scheduled_at=r.scheduled_at,duration_min=r.duration_min,mode=r.mode,location=r.location,
 recurrence=r.recurrence,occurrence_times=r.occurrence_times,class_id=r.class_id,response_note=coalesce(note,''),version=version+1,updated_at=clock_timestamp() where id=rid;
 insert into public.booking_events(request_id,actor_id,status,scheduled_at,note,details) values(rid,auth.uid(),r.status,r.scheduled_at,coalesce(note,''),learnwise_private.booking_snapshot(r));
 return rid;
end $$;
create function public.review_booking_request(rid uuid,expected_version int,action text,changes jsonb default '{}',note text default '') returns uuid
language sql security invoker set search_path='' as $$select learnwise_private.booking_review(rid,expected_version,action,changes,note)$$;
-- Keep the released time-only RPC working for older clients during deployment.
create or replace function learnwise_private.booking_respond(rid uuid,expected_version int,action text,new_time timestamptz,note text) returns uuid
language sql security invoker set search_path='' as $$select learnwise_private.booking_review(rid,expected_version,action,case when action='propose' then jsonb_build_object('scheduled_at',new_time) else '{}'::jsonb end,note)$$;
revoke all on function learnwise_private.booking_occurrences(timestamptz,jsonb),learnwise_private.booking_snapshot(public.booking_requests),learnwise_private.booking_review(uuid,int,text,jsonb,text),public.review_booking_request(uuid,int,text,jsonb,text) from public,anon;
grant execute on function learnwise_private.booking_review(uuid,int,text,jsonb,text),public.review_booking_request(uuid,int,text,jsonb,text) to authenticated;

create function learnwise_private.exam_class_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(714602);
 if tg_op='UPDATE' and new.scheduled_at=old.scheduled_at and new.duration_min=old.duration_min and new.student_id=old.student_id
 and old.deleted_at is null and old.status not in ('Cancelled','Rescheduled') then return new; end if;
 if new.deleted_at is null and new.status not in ('Cancelled','Rescheduled') and exists(select 1 from public.student_exams e where e.student_id=new.student_id and e.deleted_at is null
 and new.scheduled_at<e.scheduled_at+make_interval(mins=>e.duration_min) and e.scheduled_at<new.scheduled_at+make_interval(mins=>new.duration_min)) then
 raise exception 'Class overlaps a student exam. Choose another date or time.'; end if;
 return new;
end $$;
create trigger booking_exam_guard before insert or update of scheduled_at,duration_min,student_id,status,deleted_at on public.classes for each row execute function learnwise_private.exam_class_guard();
-- Exam changes share the scheduling lock so they cannot race class confirmations.
create function learnwise_private.exam_schedule_lock() returns trigger language plpgsql set search_path='' as $$begin perform pg_advisory_xact_lock(714602);return new;end$$;
create trigger exam_schedule_lock before insert or update on public.student_exams for each row execute function learnwise_private.exam_schedule_lock();
revoke all on function learnwise_private.exam_class_guard(),learnwise_private.exam_schedule_lock() from public,anon,authenticated;

create function learnwise_private.booking_slots_v2(aid uuid,sid uuid,duration int,loc text,requested_mode text) returns timestamptz[]
language plpgsql stable security definer set search_path='' as $$
declare a public.tutor_availability; result timestamptz[];
begin
 select * into a from public.tutor_availability where id=aid and published;
 if auth.uid() is null or a.id is null or not learnwise_private.family_student(sid) or not learnwise_private.booking_assignment(a.tutor_id,sid) then raise exception 'Availability unavailable'; end if;
 if duration is null or duration<>all(array[60,90,120,150,180]) then raise exception 'Choose 1, 1.5, 2, 2.5 or 3 hours'; end if;
 if requested_mode is null or requested_mode not in ('Online','Offline') or (a.mode<>'Either' and a.mode<>requested_mode) then raise exception 'Choose a mode supported by this availability'; end if;
 select coalesce(array_agg(slot order by slot),'{}'::timestamptz[]) into result
 from generate_series(a.starts_at,a.ends_at-make_interval(mins=>duration),interval '15 minutes') slot
 where slot>now() and slot<=now()+interval '180 days' and not exists(
 select 1 from public.classes c where c.deleted_at is null and c.status not in ('Cancelled','Rescheduled')
 and (c.tutor_id=a.tutor_id or c.student_id=sid)
 and slot<c.scheduled_at+make_interval(mins=>c.duration_min+case when c.tutor_id=a.tutor_id and (c.mode='Offline' or requested_mode='Offline')
 and not(c.mode='Offline' and requested_mode='Offline' and lower(trim(coalesce(c.location,'')))=lower(trim(coalesce(loc,''))) and length(trim(coalesce(loc,'')))>0)
 then greatest(c.travel_buffer_min,a.buffer_min) else 0 end)
 and c.scheduled_at<slot+make_interval(mins=>duration+case when c.tutor_id=a.tutor_id and (c.mode='Offline' or requested_mode='Offline')
 and not(c.mode='Offline' and requested_mode='Offline' and lower(trim(coalesce(c.location,'')))=lower(trim(coalesce(loc,''))) and length(trim(coalesce(loc,'')))>0)
 then greatest(c.travel_buffer_min,a.buffer_min) else 0 end))
 and not exists(select 1 from public.student_exams e where e.student_id=sid and e.deleted_at is null
 and slot<e.scheduled_at+make_interval(mins=>e.duration_min) and e.scheduled_at<slot+make_interval(mins=>duration));
 return result;
end $$;
create function public.booking_slots_v2(aid uuid,sid uuid,duration int,loc text,requested_mode text) returns timestamptz[]
language sql security invoker set search_path='' as $$select learnwise_private.booking_slots_v2(aid,sid,duration,loc,requested_mode)$$;
revoke all on function learnwise_private.booking_slots_v2(uuid,uuid,int,text,text),public.booking_slots_v2(uuid,uuid,int,text,text) from public,anon;
grant execute on function learnwise_private.booking_slots_v2(uuid,uuid,int,text,text),public.booking_slots_v2(uuid,uuid,int,text,text) to authenticated;
