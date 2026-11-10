import{test}from'node:test';import assert from'node:assert/strict';import{PGlite}from'@electric-sql/pglite';
import{reportedFixture,migration,asUser,id}from'./helpers/reported-production-fixture.js';
test('profile repair against a labelled reconstruction of reported production',async t=>{
 const db=new PGlite();try{
  await reportedFixture(db);
  await t.test('fixture uses five reported roles and all three staff accounts',async()=>{
   assert.deepEqual((await db.query('select role,count(*)::int as n from profiles group by role order by role')).rows,[{role:'admin_tutor',n:1},{role:'parent',n:1},{role:'student',n:2},{role:'super_admin',n:2},{role:'tutor',n:2}]);
   await assert.rejects(db.query("update profiles set role='admin'where id=$1",[id(1)]),{code:'23514'});
  });
  await t.test('own-row protection and forged-metadata bypass are reproduced only locally',async()=>{
   await assert.rejects(asUser(db,4,()=>db.query("update profiles set role='super_admin'where id=$1",[id(4)])));
   await asUser(db,4,async()=>{assert.equal((await db.query('select id from profiles')).rows.length,8);await db.query("update profiles set role='super_admin'where id=$1",[id(4)]);},{claims:{user_metadata:{role:'admin'}}});
  });
  const before=(await db.query("select tablename,policyname,qual,with_check from pg_policies where schemaname='public' and tablename<>'profiles' order by tablename,policyname")).rows;
  await db.exec(await migration('202611030001_protect_profile_updates.sql'));
  await t.test('unrelated application policies are preserved',async()=>assert.deepEqual((await db.query("select tablename,policyname,qual,with_check from pg_policies where schemaname='public' and tablename not in('profiles','permission_audit_events') order by tablename,policyname")).rows,before));
  await t.test('both Super Admins and Tutor Admin keep roles and operational access',async()=>{
   for(const n of[1,7,8])await asUser(db,n,async()=>{
    assert.equal((await db.query('select public.is_admin() as allowed')).rows[0].allowed,true);
    assert.equal((await db.query('select id from students')).rows.length,3);assert.equal((await db.query('select id from classes')).rows.length,2);
    assert.equal((await db.query('update profiles set full_name=full_name where id=$1 returning id',[id(n)])).rows.length,1);
   });
   assert.deepEqual((await db.query('select role from profiles where id=any($1)order by id',[[id(1),id(7),id(8)]])).rows.map(r=>r.role),['super_admin','super_admin','admin_tutor']);
  });
  for(const n of[2,3,4,8])await t.test(`account ${n} cannot forge metadata or call permission RPC`,async()=>{
   await assert.rejects(asUser(db,n,()=>db.query("update profiles set role='super_admin'where id=$1",[id(n)]),{claims:{user_metadata:{role:'admin'},app_metadata:{role:'admin'}}}),{code:'42501'});
   await assert.rejects(asUser(db,n,()=>db.query('select admin_update_profile($1,$2)',[id(5),{role:'super_admin'}])),{code:'42501'});
  });
  await t.test('Tutor Admin safe updates are correlated to their own row',async()=>{await asUser(db,8,async()=>assert.equal((await db.query("update profiles set full_name='forged'where id=$1 returning id",[id(4)])).rows.length,0));});
  await t.test('Super Admin changes are audited; self changes and injection are rejected',async()=>{
   await asUser(db,1,async()=>{await db.query('select admin_update_profile($1,$2)',[id(5),{role:'tutor',status:'Suspended'}]);assert.equal((await db.query('select actor_role from permission_audit_events')).rows[0].actor_role,'super_admin');});
   for(const updates of[{email:'forged'},{role:'admin'},{}])await assert.rejects(asUser(db,1,()=>db.query('select admin_update_profile($1,$2)',[id(5),updates])));
   await assert.rejects(asUser(db,1,()=>db.query('select admin_update_profile($1,$2)',[id(1),{status:'Suspended'}])),{code:'42501'});
  });
  await t.test('audit failure rolls back permissions and clients cannot tamper with events',async()=>{
   await db.exec("create function fail_audit()returns trigger language plpgsql as $$begin raise exception 'audit failed';end$$;create trigger fail_audit before insert on permission_audit_events for each row execute function fail_audit();");
   await assert.rejects(asUser(db,1,()=>db.query('select admin_update_profile($1,$2)',[id(5),{status:'Suspended'}])),/audit failed/);
   assert.equal((await db.query('select status from profiles where id=$1',[id(5)])).rows[0].status,'Active');
   for(const statement of["delete from permission_audit_events","update permission_audit_events set actor_role='student'","insert into permission_audit_events(actor_role)values('student')"])await assert.rejects(asUser(db,1,()=>db.query(statement)),{code:'42501'});
  });
  await t.test('suspended Super Admin cannot invoke permission RPC',async()=>{
   await db.query("update profiles set status='Suspended'where id=$1",[id(7)]);await assert.rejects(asUser(db,7,()=>db.query('select admin_update_profile($1,$2)',[id(5),{status:'Suspended'}])),{code:'42501'});
  });
 }finally{await db.close();}
});
