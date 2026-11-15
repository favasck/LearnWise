import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('team policies enforce scoped CRUD, retained deletions and invoice audit', async t => {
  const db = new PGlite();
  const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
  const q=(sql,args=[])=>db.query(sql,args);
  const asUser=async(n,fn)=>{
    await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','${id(n)}',true)`);
    try {return await fn();} finally {await db.exec('rollback');}
  };
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
    await db.exec(await readFile(new URL('../migrations/202611070001_bootstrap_schema.sql',import.meta.url),'utf8'));
    await db.exec(`alter table profiles drop constraint profiles_role_check;
      alter table class_notes alter column class_id drop not null;
      alter table materials alter column file_url drop not null;
      alter table profiles add constraint profiles_role_check check(role in ('super_admin','admin_tutor','tutor','parent','student','admin'));`);
    await db.exec(await readFile(new URL('../docs/sql/scoped_team_permissions.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../docs/sql/role_rpc_privileges.sql',import.meta.url),'utf8'));
    for(const [n,role] of [[1,'super_admin'],[2,'admin_tutor'],[3,'admin_tutor'],[4,'tutor'],[5,'tutor'],[6,'parent'],[7,'student']]) {
      await q('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id(n),`${n}@example.test`,{role:'student'}]);
      await q('update profiles set role=$1 where id=$2',[role,id(n)]);
    }
    for(const [n,user,manager] of [[14,4,2],[15,5,3],[12,2,null]]) await q('insert into tutors(id,user_id,full_name,managed_by_user_id) values($1,$2,$3,$4)',[id(n),id(user),`Tutor ${n}`,manager?id(manager):null]);
    await q('insert into parents(id,user_id,full_name,owner_user_id) values($1,$2,$3,$4),($5,null,$6,$7)',[id(16),id(6),'Parent A',id(2),id(17),'Parent B',id(3)]);
    await q('insert into students(id,user_id,parent_id,full_name,owner_user_id) values($1,$2,$3,$4,$5),($6,null,$7,$8,$9)',[id(18),id(7),id(16),'Student A',id(2),id(19),id(17),'Student B',id(3)]);
    await q('insert into student_tutors(student_id,tutor_id) values($1,$2),($3,$4)',[id(18),id(14),id(19),id(15)]);
    await t.test('Admin Tutor sees only own tutor/team, students and parents',()=>asUser(2,async()=>{
      assert.deepEqual((await q('select id from tutors order by id')).rows.map(x=>x.id),[id(12),id(14)]);
      assert.deepEqual((await q('select id from students')).rows.map(x=>x.id),[id(18)]);
      assert.deepEqual((await q('select id from parents')).rows.map(x=>x.id),[id(16)]);
      assert.equal((await q('select * from students where id=$1',[id(19)])).rows.length,0);
    }));
    await t.test('ordinary tutor cannot see other tutors or their people',()=>asUser(4,async()=>{
      assert.deepEqual((await q('select id from tutors')).rows.map(x=>x.id),[id(14)]);
      assert.deepEqual((await q('select id from students')).rows.map(x=>x.id),[id(18)]);
      assert.deepEqual((await q('select id from parents')).rows.map(x=>x.id),[id(16)]);
    }));
    await t.test('every role can edit own personal details without privilege escalation',async()=>{
      for(const n of [1,2,3,4,5,6,7]) await asUser(n,async()=>{
        assert.equal((await q("update profiles set full_name='Updated',phone='123' where id=$1 returning id",[id(n)])).rows.length,1);
      });
      await asUser(4,async()=>assert.rejects(q("update profiles set role='super_admin' where id=$1",[id(4)]),/Only name and phone/));
    });
    await t.test('Admin Tutor creates own people and cannot forge owner or team',()=>asUser(2,async()=>{
      const p=(await q("insert into parents(full_name) values('New parent') returning *")).rows[0];
      assert.equal(p.owner_user_id,id(2));
      assert.equal((await q('select * from parents where id=$1',[p.id])).rows.length,1);
      const tutor=(await q("insert into tutors(full_name) values('Team tutor') returning *")).rows[0];
      assert.equal(tutor.managed_by_user_id,id(2));
      await assert.rejects(q('update tutors set managed_by_user_id=$1 where id=$2',[id(3),id(14)]),/Cannot reassign/);
    }));
    await t.test('unassigned Admin Tutor has no access to unrelated work',()=>asUser(3,async()=>{
      assert.equal((await q('update students set full_name=$1 where id=$2 returning id',['Intrusion',id(18)])).rows.length,0);
      await assert.rejects(q('insert into classes(student_id,tutor_id,subject,scheduled_at) values($1,$2,$3,now())',[id(18),id(15),'Physics']),/row-level security/);
    }));
    await t.test('all operational records support add, edit, retained delete and history',async()=>{
      for(const [table,fields,values] of [
        ['students',['full_name'],['New student']],['parents',['full_name'],['New parent']],
        ['classes',['student_id','tutor_id','subject','scheduled_at'],[id(18),id(14),'Biology','2026-11-15T10:00:00Z']],
        ['class_notes',['student_id','tutor_id','summary'],[id(18),id(14),'Feedback']],
        ['homework',['student_id','tutor_id','title'],[id(18),id(14),'Worksheet']],
        ['materials',['student_id','tutor_id','title'],[id(18),id(14),'Notes']],
        ['invoices',['parent_id','student_id','invoice_number','total_qar'],[id(16),id(18),'TEST-1',100]],
        ['payments',['parent_id','student_id','tutor_id','amount_qar'],[id(16),id(18),id(14),20]],
      ]) await asUser(2,async()=>{
        const row=(await q(`insert into ${table}(${fields.join(',')}) values(${fields.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,values)).rows[0];
        const field=table==='class_notes'?'summary':table==='classes'?'topic':table==='invoices'?'notes':table==='payments'?'reference':fields.includes('full_name')?'full_name':'title';
        const edited=(await q(`update ${table} set ${field}='Edited test' where id=$1 returning *`,[row.id])).rows[0];
        assert.ok(edited.edited_at,table);
        const deleted=(await q(`update ${table} set deleted_at=now() where id=$1 returning *`,[row.id])).rows[0];
        assert.equal(deleted.deleted_by,id(2),table);
        assert.equal((await q(`select * from ${table} where id=$1`,[row.id])).rows.length,1,table);
        const events=(await q('select action,actor_user_id from audit_logs where table_name=$1 and record_id=$2 order by created_at',[table,row.id])).rows;
        assert.deepEqual(events.map(x=>x.action),['created','edited','deleted'],table);
        assert.ok(events.every(x=>x.actor_user_id===id(2)));
        await assert.rejects(q(`delete from ${table} where id=$1`,[row.id]),/permission denied/);
      });
    });
    await t.test('payment edits and deletions recalculate invoice without losing records',()=>asUser(2,async()=>{
      const inv=(await q('insert into invoices(parent_id,student_id,invoice_number,total_qar) values($1,$2,$3,100) returning *',[id(16),id(18),'PAY-1'])).rows[0];
      const pay=(await q('insert into payments(parent_id,student_id,invoice_id,amount_qar) values($1,$2,$3,40) returning *',[id(16),id(18),inv.id])).rows[0];
      assert.equal(Number((await q('select paid_qar from invoices where id=$1',[inv.id])).rows[0].paid_qar),40);
      await q('update payments set amount_qar=60 where id=$1',[pay.id]);
      assert.equal(Number((await q('select paid_qar from invoices where id=$1',[inv.id])).rows[0].paid_qar),60);
      await q('update payments set deleted_at=now() where id=$1',[pay.id]);
      assert.equal(Number((await q('select paid_qar from invoices where id=$1',[inv.id])).rows[0].paid_qar),0);
      assert.equal((await q('select * from payments where id=$1',[pay.id])).rows.length,1);
    }));
    await t.test('families and suspended tutors cannot see unrelated records',async()=>{
      await asUser(6,async()=>assert.deepEqual((await q('select id from students')).rows.map(x=>x.id),[id(18)]));
      await q("update profiles set status='Suspended' where id=$1",[id(4)]);
      await asUser(4,async()=>assert.equal((await q('select * from students')).rows.length,0));
    });
    await t.test('Super Admin role RPC switches roles, creates linked profiles and audits atomically',()=>asUser(1,async()=>{
      for(const role of ['admin_tutor','tutor','parent','student']) {
        const changed=(await q('select public.admin_update_profile($1,$2) as profile',[id(5),{role}])).rows[0].profile;
        assert.equal(changed.role,role);
        const table=['admin_tutor','tutor'].includes(role)?'tutors':role==='parent'?'parents':'students';
        assert.equal((await q(`select * from ${table} where user_id=$1`,[id(5)])).rows.length,1);
      }
      assert.equal((await q("select * from audit_logs where table_name='profiles' and record_id=$1 and action='change_role' and actor_user_id=$2",[id(5),id(1)])).rows.length,4);
      await assert.rejects(q('select public.admin_update_profile($1,$2)',[id(1),{role:'tutor'}]),/own account/);
    }));
    await t.test('Admin Tutor cannot invoke the Super Admin role editor',()=>asUser(2,async()=>{
      await assert.rejects(q('select public.admin_update_profile($1,$2)',[id(5),{role:'super_admin'}]),/Only a Super Admin/);
    }));
  } finally {await db.close();}
});
