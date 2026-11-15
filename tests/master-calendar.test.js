import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { CALENDAR_SOURCES, calendarEntryPayload, filterCalendarEntries, masterCalendarEntries, mergeCalendarCatalogue, officialExamEntries, qatarHolidayEntries } from '../src/services/masterCalendar.js';

test('official catalogue has unique dated papers/windows, provenance and no invented start times',()=>{
  const events=officialExamEntries();assert.equal(events.length,629);assert.equal(new Set(events.map(e=>e.catalog_key)).size,events.length);
  assert.deepEqual(CALENDAR_SOURCES.filter(s=>s.loaded).map(s=>s.count),[196,242,78,113]);
  assert.equal(CALENDAR_SOURCES.filter(s=>s.key.startsWith('cambridge-')).length,12);
  assert.equal(CALENDAR_SOURCES.filter(s=>!s.loaded).length,12);
  assert.ok(CALENDAR_SOURCES.some(s=>s.key==='pearson-2027-summer-r'&&s.source_url.endsWith('int-gcse-r-paper-summer-2027-final.pdf')));
  assert.ok(CALENDAR_SOURCES.some(s=>s.key==='pearson-2027-november-provisional'&&s.verification==='Provisional timetable'));
  for(const event of events){
    assert.match(event.starts_on,/^\d{4}-\d{2}-\d{2}$/);assert.equal(new Date(event.starts_on).toISOString().slice(0,10),event.starts_on);
    assert.ok(event.ends_on>=event.starts_on);assert.equal(event.starts_at,null);assert.equal(event.all_day,true);
    assert.match(event.source_url,/^https:\/\/(www\.cambridgeinternational\.org|qualifications\.pearson\.com)\//);
    assert.ok(event.source_page>=2);assert.ok(event.title.length<=220);assert.doesNotMatch(event.title,/Syllabus\/Component|Sessions:|Timetable|Homepage/);
  }
  const bio=events.find(e=>e.catalog_key==='cambridge-2027-june-z3-0610-11');assert.equal(bio.starts_on,'2027-06-08');assert.equal(bio.session_label,'PM');assert.equal(bio.duration_min,45);
  const maths=events.find(e=>e.catalog_key==='pearson-2027-summer-standard-4MA1-1H');assert.equal(maths.starts_on,'2027-05-14');assert.equal(maths.session_label,'Morning');
});
test('Qatar dates use official fixed rules and flag lunar projections as provisional',()=>{
  const dates=qatarHolidayEntries();assert.equal(dates.length,10);
  assert.equal(dates.find(e=>e.catalog_key==='qatar-2027-sports-day').starts_on,'2027-02-09');
  assert.equal(dates.find(e=>e.catalog_key==='qatar-2026-sports-day').starts_on,'2026-02-10');
  assert.ok(dates.filter(e=>/eid|ramadan/.test(e.catalog_key)).every(e=>e.verification==='Provisional'&&/estimated/.test(e.title)));
  assert.ok(dates.filter(e=>/national-day/.test(e.catalog_key)).every(e=>e.starts_on.endsWith('-12-18')));
});
test('overrides and retained removal replace official entries exactly once and filters combine',()=>{
  const base=[{id:'catalog:holiday',catalog_key:'holiday',title:'Holiday',starts_on:'2027-05-01',ends_on:'2027-05-03',category:'QatarHoliday'}];
  const saved={id:'saved',catalog_key:'holiday',title:'Updated holiday',starts_on:'2027-05-02',ends_on:'2027-05-04',category:'QatarHoliday',deleted_at:'2026-11-15T00:00Z'};
  const merged=mergeCalendarCatalogue(base,[saved]);assert.equal(merged.length,1);assert.equal(merged[0].original.title,'Holiday');
  assert.equal(filterCalendarEntries(merged,{month:'2027-05'}).length,0);assert.equal(filterCalendarEntries(merged,{month:'2027-05',showRemoved:true}).length,1);
  const entries=[...merged,{id:'class',title:'Class',category:'Class',starts_on:'2027-05-02',ends_on:'2027-05-02'},{id:'exam',title:'Biology',category:'Exam',board:'Cambridge',syllabus:'0610',starts_on:'2027-04-30',ends_on:'2027-05-02'},{id:'task',title:'Prepare',category:'Task',task_status:'Done',starts_on:'2027-05-02',ends_on:'2027-05-02'}];
  assert.deepEqual(filterCalendarEntries(entries,{month:'2027-05',categories:['Exam','Class'],board:'Cambridge'}).map(e=>e.id),['class','exam']);
  assert.deepEqual(filterCalendarEntries(entries,{month:'2027-05',categories:['Exam','Class'],board:'Cambridge',zone:'4'}).map(e=>e.id),['class']);
  assert.equal(filterCalendarEntries(entries,{month:'2027-05',search:'0610'}).length,1);
  assert.equal(filterCalendarEntries(entries,{categories:['Task'],taskStatus:'Open'}).length,0);
  assert.equal(filterCalendarEntries(entries,{categories:[]}).length,0);
});
test('operational classes, exams, requests and homework keep their source identity and Qatar day',()=>{
  const events=masterCalendarEntries({classes:[{id:'class',subject:'Math',scheduled_at:'2030-01-02T20:00Z',duration_min:60},{id:'cancel',status:'Cancelled',scheduled_at:'2030-01-02T20:00Z'}],exams:[{id:'exam',title:'Physics',scheduled_at:'2030-01-03T05:00Z',duration_min:90}],requests:[{id:'request',status:'Pending',subject:'Biology',scheduled_at:'2030-01-04T06:00Z',occurrence_times:['2030-01-04T06:00Z','2030-01-11T06:00Z'],duration_min:60}],homework:[{id:'homework',title:'Worksheet',due_at:'2030-01-02T22:00Z',status:'Submitted'}]},[]);
  assert.equal(events.length,5);const c=events.find(e=>e.origin==='class');assert.equal(c.starts_on,'2030-01-02');assert.equal(c.ends_on,'2030-01-02');
  assert.equal(events.find(e=>e.origin==='homework').starts_on,'2030-01-03');assert.equal(events.find(e=>e.origin==='homework').task_status,'Done');
  assert.equal(events.filter(e=>e.category==='Request').length,2);
  assert.equal(calendarEntryPayload({...c,owner_user_id:'forged'}).owner_user_id,undefined);
});

test('master calendar database enforces shared dates, private tasks, immutable identity and retained audit',async t=>{
  const db=new PGlite(),id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
  const q=(sql,args=[])=>db.query(sql,args);
  async function as(n,fn,commit=false){await db.exec('begin');try{await q("select set_config('request.jwt.claim.sub',$1,true)",[id(n)]);await db.exec('set local role authenticated');const r=await fn();await db.exec(commit?'commit':'rollback');return r;}catch(e){await db.exec('rollback');throw e;}}
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
    await db.exec(await readFile(new URL('../migrations/202611070001_bootstrap_schema.sql',import.meta.url),'utf8'));
    await db.exec("alter table profiles drop constraint profiles_role_check;alter table profiles add constraint profiles_role_check check(role in ('super_admin','admin_tutor','admin','tutor','parent','student'));");
    for(const file of ['scoped_team_permissions.sql','role_rpc_privileges.sql','master_calendar.sql'])await db.exec(await readFile(new URL('../docs/sql/'+file,import.meta.url),'utf8'));
    for(const [n,role] of [[1,'super_admin'],[2,'tutor'],[3,'parent'],[4,'student'],[5,'tutor']]){await q('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id(n),`${n}@example.test`,{}]);await q('update profiles set role=$1 where id=$2',[role,id(n)]);}
    const add=(title,visibility='shared',catalogKey=null)=>q("insert into calendar_entries(title,category,visibility,starts_on,ends_on,catalog_key) values($1,'Task',$2,'2030-01-02','2030-01-02',$3) returning *",[title,visibility,catalogKey]);
    const shared=(await as(2,()=>add('Shared exam date','shared','official-paper'),true)).rows[0];
    const privateTask=(await as(2,()=>add('Private preparation','private'),true)).rows[0];
    await t.test('family reads shared events only and cannot write master dates',async()=>{
      for(const n of [3,4])await as(n,async()=>assert.deepEqual((await q('select title from calendar_entries')).rows.map(r=>r.title),['Shared exam date']));
      await assert.rejects(as(3,()=>add('Forged date')),/row-level security/);
      await as(4,async()=>assert.equal((await q("update calendar_entries set title='forged' where id=$1 returning id",[shared.id])).rows.length,0));
    });
    await t.test('other tutors edit shared dates, while private tasks stay private',async()=>{
      await as(5,async()=>{assert.equal((await q('select * from calendar_entries where id=$1',[privateTask.id])).rows.length,0);assert.equal((await q("update calendar_entries set title='Changed shared date' where id=$1 returning version",[shared.id])).rows[0].version,2);});
      await assert.rejects(as(5,()=>q("update calendar_entries set visibility='private' where id=$1",[shared.id])),/Only the author/);
      await as(1,async()=>assert.equal((await q('select * from calendar_entries')).rows.length,2));
    });
    await t.test('identity, creator, version and permanent deletion are protected',async()=>{
      for(const field of ['owner_user_id','catalog_key','version'])await assert.rejects(as(2,()=>q(`update calendar_entries set ${field}=$1 where id=$2`,[field==='version'?99:field==='catalog_key'?'changed':id(5),shared.id])),/permission denied/);
      await assert.rejects(as(2,()=>q('delete from calendar_entries where id=$1',[shared.id])),/permission denied/);
      await as(2,async()=>assert.equal((await q("update calendar_entries set title='Stale update' where id=$1 and version=99 returning id",[shared.id])).rows.length,0));
    });
    await t.test('removal, restoration and task completion retain server-authored history',async()=>{await as(2,async()=>{
      await q('update calendar_entries set deleted_at=now() where id=$1',[shared.id]);
      const restored=(await q("update calendar_entries set deleted_at=null,task_status='Done' where id=$1 returning *",[shared.id])).rows[0];
      assert.equal(restored.version,3);assert.equal(restored.edited_by,id(2));assert.equal(restored.task_status,'Done');
    },true);assert.equal((await q("select count(*)::int as count from audit_logs where table_name='calendar_entries' and record_id=$1",[shared.id])).rows[0].count,3);});
    await t.test('invalid dates and unsafe source URLs are rejected',async()=>{
      await assert.rejects(as(2,()=>q("insert into calendar_entries(title,category,starts_on,ends_on,source_url) values('Bad','Exam','2030-01-02','2030-01-01','https://example.test')")),/check constraint/);
      await assert.rejects(as(2,()=>q("insert into calendar_entries(title,category,starts_on,ends_on,source_url) values('Bad','Exam','2030-01-02','2030-01-02','javascript:alert(1)')")),/check constraint/);
      await assert.rejects(as(2,()=>q("insert into calendar_entries(title,category,starts_on,ends_on,all_day,starts_at,duration_min) values('Bad','Task','2030-01-02','2030-01-02',false,'2030-01-02T22:00Z',60)")),/check constraint/);
    });
    await t.test('suspension and anonymous access deny master calendar data',async()=>{
      await q("update profiles set status='Suspended' where id=$1",[id(2)]);await as(2,async()=>assert.equal((await q('select * from calendar_entries')).rows.length,0));
      await assert.rejects(as(2,()=>add('Suspended')),/row-level security/);
      await db.exec('begin;set local role anon');try{await assert.rejects(q('select * from calendar_entries'),/permission denied/);}finally{await db.exec('rollback');}
    });
  }finally{await db.close();}
});

