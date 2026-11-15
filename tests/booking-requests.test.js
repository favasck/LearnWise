import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { qatarInput, qatarInstant, nearbyClasses, recurrenceTimes, bookingCalendarItems } from '../src/services/booking.js';

test('Qatar booking times are independent of browser timezone',()=>{
  assert.equal(qatarInstant('2030-01-02T17:30'),'2030-01-02T14:30:00.000Z');
  assert.equal(qatarInput('2030-01-02T14:30:00Z'),'2030-01-02T17:30');
  assert.equal(nearbyClasses([{scheduled_at:'2030-01-01T22:00:00Z',status:'Scheduled'},{scheduled_at:'2030-01-02T12:00:00Z',status:'Cancelled'}],'2030-01-02T10:00:00Z').length,1);
});

test('booking authorization, alternatives, calendar posting and travel protection',async t=>{
  const db=new PGlite();
  const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
  const futureDay=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  const q=(sql,args=[])=>db.query(sql.replaceAll('2030-01-02',futureDay),JSON.parse(JSON.stringify(args).replaceAll('2030-01-02',futureDay)));
  async function as(n,fn,commit=false){
    await db.exec('begin');
    try{await q("select set_config('request.jwt.claim.sub',$1,true)",[id(n)]);await db.exec('set local role authenticated');const result=await fn();await db.exec(commit?'commit':'rollback');return result;}
    catch(e){await db.exec('rollback');throw e;}
  }
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
    for(const file of ['migrations/202611070001_bootstrap_schema.sql','docs/sql/scoped_team_permissions.sql','docs/sql/role_rpc_privileges.sql','docs/sql/booking_requests.sql','docs/sql/recurring_booking_review.sql']){
      if(file.includes('scoped_team'))await db.exec("alter table profiles drop constraint profiles_role_check;alter table profiles add constraint profiles_role_check check(role in ('admin','super_admin','admin_tutor','tutor','parent','student'));");
      await db.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
    }
    for(const [n,role] of [[1,'super_admin'],[2,'tutor'],[3,'parent'],[4,'student'],[5,'student'],[6,'tutor'],[7,'parent']]){
      await q('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id(n),`${n}@example.test`,{}]);
      await q('update profiles set role=$1 where id=$2',[role,id(n)]);
    }
    await q("insert into tutors(id,user_id,full_name) values($1,$1,'Tutor A'),($2,$2,'Tutor B')",[id(2),id(6)]);
    await q("insert into parents(id,user_id,full_name) values($1,$1,'Parent A'),($2,$2,'Parent B')",[id(3),id(7)]);
    await q("insert into students(id,user_id,parent_id,full_name) values($1,$1,$2,'Student A'),($3,$3,$4,'Student B')",[id(4),id(3),id(5),id(7)]);
    await q('insert into student_tutors(student_id,tutor_id) values($1,$2),($3,$2)',[id(4),id(2),id(5)]);
    const aid=(await as(2,()=>q("insert into tutor_availability(tutor_id,starts_at,ends_at,mode,area) values($1,'2030-01-02T12:00Z','2030-01-02T18:00Z','Offline','Al Wakrah') returning id",[id(2)]),true)).rows[0].id;
    const payload={tutor_id:id(2),student_id:id(4),availability_id:aid,preferred_times:['2030-01-02T13:00Z'],duration_min:60,subject:'Math',mode:'Offline',location:'Building A',notes:'Flexible'};
    const submit=(p=payload)=>q('select submit_booking_request($1) as id',[p]);
    const respond=(rid,version,action,time=null)=>q('select respond_booking_request($1,$2,$3,$4,$5)',[rid,version,action,time,'Response']);
    await t.test('unrelated families cannot submit or inspect slots',async()=>{
      await assert.rejects(as(7,()=>submit()),/Not authorized/);
      await assert.rejects(as(7,()=>q('select booking_slots($1,$2,60,$3)',[aid,id(4),'Building A'])),/unavailable/);
      await assert.rejects(as(3,()=>submit({...payload,student_id:id(5)})),/Not authorized/);
      await assert.rejects(as(3,()=>q("insert into tutor_availability(tutor_id,starts_at,ends_at,mode) values($1,'2030-01-01','2030-01-02','Online')",[id(2)])),/row-level security/);
    });
    const rid=(await as(3,()=>submit(),true)).rows[0].id;
    await t.test('request is private and does not create a class',async()=>{
      assert.equal((await q('select * from classes')).rows.length,0);
      await as(7,async()=>assert.equal((await q('select * from booking_requests')).rows.length,0));
      await as(6,async()=>assert.equal((await q('select * from booking_requests')).rows.length,0));
      await assert.rejects(as(3,()=>q("update booking_requests set status='Confirmed' where id=$1",[rid])),/permission denied/);
      await assert.rejects(as(3,()=>respond(rid,1,'confirm')),/not allowed/);
    });
    await as(2,()=>respond(rid,1,'propose','2030-01-02T14:00Z'),true);
    await t.test('alternative requires family acceptance; stale writes fail',async()=>{
      assert.equal((await q('select * from classes')).rows.length,0);
      await assert.rejects(as(2,()=>respond(rid,2,'confirm')),/not allowed/);
      await assert.rejects(as(3,()=>respond(rid,1,'accept')),/changed/);
    });
    await as(4,()=>respond(rid,2,'accept'),true);
    await t.test('acceptance posts exactly one class and retains activity',async()=>{
      const c=(await q('select * from classes')).rows[0];
      assert.equal(c.student_id,id(4));assert.equal(c.location,'Building A');assert.equal(c.owner_user_id,id(2));
      assert.equal((await q('select * from booking_events where request_id=$1',[rid])).rows.length,3);
      await assert.rejects(as(3,()=>respond(rid,3,'accept')),/resolved/);
      assert.equal((await q('select * from classes')).rows.length,1);
    });
    await t.test('travel gap blocks other locations, same-location adjacency works',async()=>{
      const other=(await as(7,()=>submit({...payload,student_id:id(5),preferred_times:['2030-01-02T15:00Z'],location:'Building B'}),true)).rows[0].id;
      await assert.rejects(as(2,()=>respond(other,1,'confirm')),/travel buffer/);
      assert.equal((await q('select status from booking_requests where id=$1',[other])).rows[0].status,'Pending');
      const same=(await as(7,()=>submit({...payload,student_id:id(5),preferred_times:['2030-01-02T15:00Z']}),true)).rows[0].id;
      await as(2,()=>respond(same,1,'confirm'),true);
      const slots=(await as(3,()=>q('select booking_slots($1,$2,60,$3) as slots',[aid,id(4),'Building B']))).rows[0].slots;
      assert.ok(!slots.some(s=>new Date(s).toISOString()===`${futureDay}T13:30:00.000Z`));
    });
    await t.test('existing admin scheduling path also enforces conflicts',async()=>{
      await assert.rejects(as(1,()=>q("insert into classes(student_id,tutor_id,subject,scheduled_at) values($1,$2,'Physics','2030-01-02T14:00Z')",[id(5),id(2)])),/conflicts/);
      await assert.rejects(as(1,()=>q("insert into classes(student_id,tutor_id,subject,scheduled_at) values($1,$2,'Physics','2030-01-02T14:00Z')",[id(4),id(6)])),/conflicts/);
    });
    await t.test('recurrence matches the calendar preview for every frequency and month end',async()=>{
      const start=`${futureDay}T06:00:00Z`,day=new Date(`${futureDay}T09:00:00Z`).getUTCDay();
      for(const frequency of ['once','weekly','twice_weekly','fortnightly','monthly']){
        const rule={frequency,count:frequency==='once'?1:4,weekdays:frequency==='twice_weekly'?[day,(day+3)%7].sort():[day]};
        const rows=(await q('select learnwise_private.booking_occurrences($1,$2) as dates',[start,rule])).rows[0].dates;
        assert.deepEqual(rows.map(d=>new Date(d).toISOString()),recurrenceTimes(start,rule),frequency);
      }
      const rule={frequency:'monthly',count:3,weekdays:[]};
      assert.deepEqual(recurrenceTimes('2030-01-31T20:00:00Z',rule),['2030-01-31T20:00:00.000Z','2030-02-28T20:00:00.000Z','2030-03-31T20:00:00.000Z']);
      const dates=(await q("select learnwise_private.booking_occurrences('2030-01-31T20:00Z',$1) as dates",[rule])).rows[0].dates;
      assert.deepEqual(dates.map(d=>new Date(d).toISOString()),recurrenceTimes('2030-01-31T20:00Z',rule));
      assert.throws(()=>recurrenceTimes(start,{frequency:'weekly',count:4,weekdays:[]}),/weekday/);
      const items=bookingCalendarItems([{id:'pending',status:'Pending',student_name:'Booking name',scheduled_at:start,occurrence_times:[start,'2030-02-01T06:00Z'],duration_min:90},{id:'confirmed',status:'Confirmed',scheduled_at:start}]);
      assert.equal(items.length,2);assert.equal(items[0].kind,'Pending');assert.equal(items[0].student.full_name,'Booking name');
    });
    await t.test('fixed lengths are enforced and area-free availability supports both modes',async()=>{
      await as(2,()=>q("insert into tutor_availability(tutor_id,starts_at,ends_at,mode) values($1,'2030-01-02T06:00Z','2030-01-02T12:00Z','Either')",[id(2)]));
      await assert.rejects(as(3,()=>submit({...payload,duration_min:45})),/Choose 1/);
      await assert.rejects(as(3,()=>submit({...payload,availability_id:null,recurrence:{frequency:'weekly',count:4,weekdays:[]}})),/weekdays/);
    });
    const review=(rid,version,action,changes={})=>q('select review_booking_request($1,$2,$3,$4,$5)',[rid,version,action,changes,'Reviewed details']);
    await t.test('tutor changes hours, mode, location and repeat pattern; family accepts the whole proposal',async()=>{
      const start=`${futureDay}T06:00:00Z`,day=new Date(start).getUTCDay();
      const booking=(await as(3,()=>submit({...payload,availability_id:null,preferred_times:[start],student_name:'Student booking name',student_details:'Year 10 · exam preparation'}),true)).rows[0].id;
      const changes={scheduled_at:start,duration_min:150,mode:'Online',location:'',recurrence:{frequency:'weekly',count:2,weekdays:[day]}};
      await assert.rejects(as(3,()=>review(booking,1,'propose',changes)),/not allowed/);
      await assert.rejects(as(2,()=>review(booking,1,'propose',{student_id:id(5)})),/Unsupported/);
      await as(2,()=>review(booking,1,'propose',changes),true);
      await assert.rejects(as(3,()=>review(booking,2,'accept',{duration_min:60})),/proposal/);
      await as(3,()=>review(booking,2,'accept'),true);
      const classes=(await q('select * from classes where booking_request_id=$1 order by scheduled_at',[booking])).rows;
      assert.equal(classes.length,2);assert.ok(classes.every(c=>c.duration_min===150&&c.mode==='Online'&&c.location===null));
      const request=(await q('select * from booking_requests where id=$1',[booking])).rows[0];
      assert.equal(request.student_name,'Student booking name');assert.equal(request.student_details,'Year 10 · exam preparation');
      const events=(await q('select details from booking_events where request_id=$1 order by created_at',[booking])).rows;
      assert.equal(events[0].details.duration_min,60);assert.equal(events[1].details.duration_min,150);assert.equal(events[1].details.mode,'Online');
      await assert.rejects(as(3,()=>review(booking,3,'accept')),/resolved/);
    });
    await t.test('later exam conflicts roll back the entire series and exam access is scoped',async()=>{
      const start=`${futureDay}T10:00:00Z`,day=new Date(start).getUTCDay();
      const examAt=new Date(new Date(start).getTime()+21*86400000).toISOString();
      const exam=(await as(3,()=>q("insert into student_exams(student_id,title,scheduled_at,duration_min) values($1,'Math exam',$2,120) returning id",[id(4),examAt]),true)).rows[0].id;
      await assert.rejects(as(7,()=>q("insert into student_exams(student_id,title,scheduled_at) values($1,'Unauthorized',$2)",[id(4),examAt])),/row-level security/);
      await as(7,async()=>assert.equal((await q('select * from student_exams where id=$1',[exam])).rows.length,0));
      await assert.rejects(as(3,()=>q('update student_exams set student_id=$1 where id=$2',[id(5),exam])),/permission denied/);
      const booking=(await as(3,()=>submit({...payload,availability_id:null,preferred_times:[start],mode:'Online',location:'',recurrence:{frequency:'weekly',count:4,weekdays:[day]}}),true)).rows[0].id;
      await assert.rejects(as(2,()=>review(booking,1,'confirm')),/student exam/);
      assert.equal((await q('select * from classes where booking_request_id=$1',[booking])).rows.length,0);
      assert.equal((await q('select status from booking_requests where id=$1',[booking])).rows[0].status,'Pending');
      await as(3,()=>q('update student_exams set deleted_at=now() where id=$1',[exam]),true);
      await as(2,()=>review(booking,1,'confirm'),true);
      assert.equal((await q('select * from classes where booking_request_id=$1',[booking])).rows.length,4);
    });
    await t.test('later tutor clashes also roll back all occurrences',async()=>{
      const start=`${futureDay}T14:00:00Z`;
      // Place a separate confirmed class in the second week of a new series.
      const safeStart=new Date(new Date(start).getTime()+2*86400000).toISOString();
      const second=new Date(new Date(safeStart).getTime()+7*86400000).toISOString();
      await q("insert into classes(student_id,tutor_id,subject,scheduled_at,mode) values($1,$2,'Existing',$3,'Online')",[id(5),id(2),second]);
      const booking=(await as(3,()=>submit({...payload,availability_id:null,preferred_times:[safeStart],mode:'Online',location:'',recurrence:{frequency:'weekly',count:3,weekdays:[new Date(safeStart).getUTCDay()]}}),true)).rows[0].id;
      await assert.rejects(as(2,()=>review(booking,1,'confirm')),/conflicts/);
      assert.equal((await q('select * from classes where booking_request_id=$1',[booking])).rows.length,0);
    });
    await t.test('twice-weekly, fortnightly and monthly confirmation produce every planned class',async()=>{
      const start=`${futureDay}T17:00:00Z`,day=new Date(start).getUTCDay();
      for(const frequency of ['twice_weekly','fortnightly','monthly']){
        const recurrence={frequency,count:4,weekdays:frequency==='twice_weekly'?[day,(day+2)%7].sort():[day]};
        const booking=(await as(3,()=>submit({...payload,availability_id:null,preferred_times:[start],mode:'Online',location:'',recurrence}),true)).rows[0].id;
        await as(2,async()=>{
          await review(booking,1,'confirm');
          const classes=(await q('select * from classes where booking_request_id=$1 order by scheduled_at',[booking])).rows;
          assert.deepEqual(classes.map(c=>new Date(c.scheduled_at).toISOString()),recurrenceTimes(start,recurrence),frequency);
        });
      }
    });
    await t.test('closed windows, revoked assignments and suspended actors reject writes',async()=>{
      await as(2,()=>q('update tutor_availability set published=false where id=$1',[aid]),true);
      await assert.rejects(as(3,()=>submit()),/changed/);
      await q('update student_tutors set is_active=false where student_id=$1',[id(4)]);
      await assert.rejects(as(3,()=>submit({...payload,availability_id:null})),/Not authorized/);
      await q("update profiles set status='Suspended' where id=$1",[id(2)]);
      await assert.rejects(as(2,()=>q('update tutor_availability set published=true where id=$1 returning id',[aid])).then(r=>{if(!r.rows.length)throw Error('denied')}),/denied|row-level/);
    });
  }finally{await db.close();}
});
