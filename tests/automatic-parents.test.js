import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('every student gets a parent atomically while existing families and permissions are preserved',async t=>{
  const db=new PGlite();const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
  const q=(sql,args=[])=>db.query(sql,args);
  const sql=await readFile(new URL('../docs/sql/automatic_student_parents.sql',import.meta.url),'utf8');
  const as=async(n,fn)=>{
    await db.exec('begin');await q("select set_config('request.jwt.claim.sub',$1,true)",[id(n)]);await db.exec('set local role authenticated');
    try{return await fn();}finally{await db.exec('rollback');}
  };
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
    await db.exec(await readFile(new URL('../migrations/202611070001_bootstrap_schema.sql',import.meta.url),'utf8'));
    await db.exec("alter table profiles drop constraint profiles_role_check;alter table profiles add constraint profiles_role_check check(role in ('admin','super_admin','admin_tutor','tutor','parent','student'))");
    await db.exec(await readFile(new URL('../docs/sql/scoped_team_permissions.sql',import.meta.url),'utf8'));
    for(const [n,role] of [[1,'super_admin'],[2,'admin_tutor'],[3,'admin_tutor'],[4,'student']]){
      await q('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id(n),`${n}@example.test`,{}]);
      await q('update profiles set role=$1 where id=$2',[role,id(n)]);
    }
    const existing=(await q("insert into parents(full_name,owner_user_id) values('Known Parent',$1) returning id",[id(2)])).rows[0].id;
    for(const [n,name,parent,deleted] of [[10,'Sibling A',existing,null],[11,'Sibling B',existing,null],[12,'Same Name',null,null],[13,'Same Name',null,null],[14,'Deleted Student',null,'2026-01-01']])
      await q('insert into students(id,full_name,parent_id,owner_user_id,deleted_at) values($1,$2,$3,$4,$5)',[id(n),name,parent,id(2),deleted]);
    await db.exec(sql);
    await t.test('backfill creates one placeholder per unlinked student, excludes deleted students and preserves siblings',async()=>{
      const rows=(await q('select id,parent_id from students order by id')).rows;
      assert.equal(rows[0].parent_id,existing);assert.equal(rows[1].parent_id,existing);
      assert.ok(rows[2].parent_id);assert.notEqual(rows[2].parent_id,rows[3].parent_id);assert.equal(rows[4].parent_id,null);
      assert.equal((await q('select count(*)::int n from parents')).rows[0].n,3);
      assert.equal((await q('select count(*)::int n from parents where is_placeholder and owner_user_id=$1',[id(2)])).rows[0].n,2);
    });
    await t.test('replay does not create duplicate parents',async()=>{await db.exec(sql);assert.equal((await q('select count(*)::int n from parents')).rows[0].n,3);});
    await t.test('authenticated student creation returns the saved automatic parent with matching scope',()=>as(2,async()=>{
      const student=(await q("insert into students(full_name) values('New Learner') returning *")).rows[0];
      const parent=(await q('select * from parents where id=$1',[student.parent_id])).rows[0];
      assert.equal(parent.full_name,'Parent of New Learner');assert.equal(parent.is_placeholder,true);assert.equal(parent.owner_user_id,id(2));
      await q("update parents set full_name='Actual Parent' where id=$1",[parent.id]);
      assert.equal((await q('select is_placeholder from parents where id=$1',[parent.id])).rows[0].is_placeholder,false);
      await q("update students set full_name='Renamed Learner' where id=$1",[student.id]);
      assert.equal((await q('select full_name from parents where id=$1',[parent.id])).rows[0].full_name,'Actual Parent');
    }));
    await t.test('siblings can be grouped under an existing parent; clearing the link creates a new placeholder',()=>as(2,async()=>{
      await q('update students set parent_id=$1 where id=$2',[existing,id(12)]);
      assert.equal((await q('select count(*)::int n from students where parent_id=$1',[existing])).rows[0].n,3);
      const student=(await q('update students set parent_id=null where id=$1 returning *',[id(12)])).rows[0];assert.ok(student.parent_id);assert.notEqual(student.parent_id,existing);
    }));
    await t.test('a failed student insert rolls back its automatic parent',()=>as(2,async()=>{
      const before=(await q('select count(*)::int n from parents')).rows[0].n;
      await db.exec('savepoint rejected');
      await assert.rejects(q("insert into students(id,full_name) values($1,'Duplicate')",[id(10)]));await db.exec('rollback to rejected');
      assert.equal((await q('select count(*)::int n from parents')).rows[0].n,before);
    }));
    await t.test('other teams and family accounts gain no roster or parent access',async()=>{
      await as(3,async()=>assert.equal((await q('select * from parents')).rows.length,0));
      await as(4,async()=>{
        assert.equal((await q('select * from parents')).rows.length,0);
        await assert.rejects(q("insert into students(full_name) values('Unauthorized')"),/row-level security/);
      });
    });
  }finally{await db.close();}
});
