import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('clean bootstrap, profile protection and bootstrap replay work on empty PostgreSQL', async t => {
  const db = new PGlite();
  const bootstrap = await readFile(new URL('../migrations/202611070001_bootstrap_schema.sql', import.meta.url), 'utf8');
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;`);
    await db.exec(bootstrap);
    await db.exec(bootstrap);
    await db.exec(await readFile(new URL('../migrations/202611030001_protect_profile_updates.sql', import.meta.url), 'utf8'));
    await db.exec(bootstrap);
    await t.test('all application tables have RLS and policies', async () => {
      const tables = ['profiles','tutors','parents','students','student_tutors','classes','class_notes','homework','invoices','payments','materials','assessment_requests','audit_logs','permission_audit_events'];
      const result = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relrowsecurity order by c.relname`);
      assert.deepEqual(result.rows.map(r => r.relname), tables.sort());
      for (const table of tables) assert.ok((await db.query('select 1 from pg_policies where schemaname=$1 and tablename=$2', ['public',table])).rows.length);
      assert.equal((await db.query("select to_regprocedure('public.admin_update_profile(uuid,jsonb)') is not null as found")).rows[0].found,true);
    });
    const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
    for (const [n,role] of [[1,'super_admin'],[2,'tutor'],[3,'parent'],[4,'student'],[5,'student'],[6,'tutor']]) {
      await db.query('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)',[id(n),`${n}@example.test`,{role}]);
    }
    await db.query("update public.profiles set role='super_admin' where id=$1",[id(1)]);
    await db.query('insert into public.parents(id,user_id,full_name) values ($1,$2,$3)',[id(3),id(3),'Parent']);
    for(const n of [2,6]) await db.query('insert into public.tutors(id,user_id,full_name) values ($1,$2,$3)',[id(n),id(n),'Tutor']);
    for(const n of [4,5]) await db.query('insert into public.students(id,user_id,parent_id,full_name) values ($1,$2,$3,$4)',[id(n),id(n),n===4?id(3):null,'Student']);
    await db.query('insert into public.student_tutors(student_id,tutor_id) values ($1,$2)',[id(4),id(2)]);
    await db.query("insert into public.classes(id,student_id,tutor_id,subject,scheduled_at) values ($1,$2,$3,'Math',now())",[id(10),id(4),id(2)]);
    async function asUser(n, fn, role='authenticated') {
      await db.exec('begin');
      try {
        await db.query("select set_config('request.jwt.claim.sub',$1,true)",[n?id(n):'']);
        await db.exec(`set local role ${role}`);
        return await fn();
      } finally { await db.exec('rollback'); }
    }
    await t.test('signup metadata cannot create an administrator',async()=>{
      assert.equal((await db.query('select role from profiles where id=$1',[id(1)])).rows[0].role,'super_admin');
      await db.query('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)',[id(7),'7@example.test',{role:'super_admin'}]);
      assert.equal((await db.query('select role from profiles where id=$1',[id(7)])).rows[0].role,'student');
    });
    await t.test('replay cannot restore profile escalation grants',async()=>{
      await assert.rejects(asUser(4,()=>db.query("update profiles set role='super_admin' where id=$1",[id(4)])),{code:'42501'});
      await assert.rejects(asUser(4,()=>db.query('select admin_update_profile($1,$2)',[id(5),{role:'super_admin'}])),{code:'42501'});
    });
    await t.test('admin RPC remains available and audited after replay',async()=>{
      await asUser(1,async()=>{
        await db.query('select admin_update_profile($1,$2)',[id(5),{status:'Suspended'}]);
        assert.equal((await db.query('select count(*)::int as n from permission_audit_events')).rows[0].n,1);
      });
    });
    await t.test('related reads avoid recursion and isolate students and tutors',async()=>{
      for(const n of [2,3,4]) await asUser(n,async()=>{
        assert.equal((await db.query('select id from students')).rows.length,1);
        assert.equal((await db.query('select id from classes')).rows.length,1);
        assert.equal((await db.query('select id from tutors')).rows.length,1);
      });
      await asUser(6,async()=>assert.equal((await db.query('select id from classes')).rows.length,0));
    });
    await t.test('tutor can mark attendance but cannot move a class or forge assignments',async()=>{
      await asUser(2,()=>db.query("update classes set attendance='Present' where id=$1",[id(10)]));
      await assert.rejects(asUser(2,()=>db.query("update classes set student_id=$1 where id=$2",[id(5),id(10)])),{code:'42501'});
      await assert.rejects(asUser(2,()=>db.query("insert into homework(tutor_id,student_id,title) values ($1,$2,'forged')",[id(2),id(5)])),{code:'42501'});
    });
    await t.test('unshared notes are hidden from family and revoked assignments deny tutor reads',async()=>{
      await db.query("insert into class_notes(class_id,tutor_id,student_id,is_shared_with_parent) values ($1,$2,$3,false)",[id(10),id(2),id(4)]);
      for(const n of [3,4]) await asUser(n,async()=>assert.equal((await db.query('select * from class_notes')).rows.length,0));
      await db.exec('update student_tutors set is_active=false');
      await asUser(2,async()=>assert.equal((await db.query('select * from classes')).rows.length,0));
    });
    await t.test('public assessment insert succeeds without exposing requests',async()=>{
      await asUser(null,()=>db.query("insert into assessment_requests(parent_name,parent_email,student_name) values ('Parent','p@example.test','Child')"),'anon');
      await assert.rejects(asUser(null,()=>db.query('select * from assessment_requests'),'anon'),{code:'42501'});
    });
    await t.test('suspension revokes relational access',async()=>{
      await db.query("update profiles set status='Suspended' where id=$1",[id(3)]);
      await asUser(3,async()=>assert.equal((await db.query('select * from students')).rows.length,0));
    });
    await t.test('legacy admin is rejected without remapping existing accounts',async()=>{
      await assert.rejects(db.query("update profiles set role='admin'where id=$1",[id(1)]),{code:'23514'});
      assert.equal((await db.query('select role from profiles where id=$1',[id(1)])).rows[0].role,'super_admin');
    });
  } finally { await db.close(); }
});

