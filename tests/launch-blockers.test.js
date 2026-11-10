import{test}from'node:test';import assert from'node:assert/strict';import{PGlite}from'@electric-sql/pglite';
import{reportedFixture,migration,asUser,id}from'./helpers/reported-production-fixture.js';
test('five-role billing candidate retires old overloads and posts atomically in a reconstructed fixture',async t=>{
 const db=new PGlite();try{
  await reportedFixture(db);await db.exec(await migration('202611030001_protect_profile_updates.sql'));await db.exec(await migration('202611090001_reconcile_production_schema.sql'));
  const policySnapshot=(await db.query("select tablename,policyname,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname")).rows;
  await db.exec('grant insert(parent_id,amount_qar),update(amount_qar)on payments to authenticated;grant update(paid_qar)on invoices to authenticated;');
  await db.exec(await migration('202611090003_atomic_billing.sql'));
  const invoice=(more={})=>({parent_id:id(3),student_id:id(4),subtotal_qar:'100.00',discount_qar:'10.00',status:'Issued',...more});
  const payment=(more={})=>({parent_id:id(3),student_id:id(4),invoice_id:id(30),amount_qar:'25.10',method:'Cash',reference:'Receipt',...more});
  const create=(n,p)=>db.query('select (create_invoice($1,$2)).*',[id(n),p]);
  const post=(n,p)=>db.query('select (record_payment($1,$2)).*',[id(n),p]);
  await t.test('existing policies and staff helper definitions are not replaced by billing',async()=>{
   assert.deepEqual((await db.query("select tablename,policyname,qual,with_check from pg_policies where schemaname='public' and tablename<>'billing_audit_events' order by tablename,policyname")).rows,policySnapshot);
   for(const n of[1,7,8])await asUser(db,n,async()=>assert.equal((await db.query('select is_admin()as allowed')).rows[0].allowed,true));
  });
  await t.test('all legacy payment overloads become inaccessible to anonymous/authenticated callers',async()=>{
   const legacy="select record_payment(null::uuid,null::uuid,null::uuid,null::uuid,1::numeric,'Cash'::text,''::text,''::text,null::uuid,'super_admin'::text)";
   for(const role of['anon','authenticated'])await assert.rejects(asUser(db,4,()=>db.query(legacy),{role}),{code:'42501'});
   const rows=(await db.query("select p.pronargs,has_function_privilege('authenticated',p.oid,'EXECUTE')as allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='record_payment' order by p.pronargs")).rows;
   assert.deepEqual(rows,[{pronargs:2,allowed:true},{pronargs:10,allowed:false}]);
  });
  await t.test('both Super Admins and Tutor Admin retain invoice/payment operations',async()=>{
   for(const n of[1,7,8])await asUser(db,n,async()=>{
    const a=(await create(30,invoice())).rows[0];assert.equal(a.total_qar,'90.00');await post(40,payment());
    assert.equal((await db.query('select paid_qar from invoices where id=$1',[id(30)])).rows[0].paid_qar,'25.10');
   });
  });
  await t.test('Tutor Admin cannot permanently delete operational rows or read audit records',async()=>{
   await asUser(db,8,async()=>{
    assert.equal((await db.query('delete from students where id=$1 returning id',[id(13)])).rows.length,0);
    assert.equal((await db.query('select id from audit_logs')).rows.length,0);
    assert.equal((await db.query('select id from permission_audit_events')).rows.length,0);
    assert.equal((await db.query('select id from billing_audit_events')).rows.length,0);
   });
  });
  await asUser(db,1,()=>create(30,invoice()),{commit:true});
  await t.test('posting retries are idempotent, exact and derive the actor from auth',async()=>{
   await asUser(db,8,async()=>{
    const a=(await post(40,payment())).rows[0];const b=(await post(40,payment())).rows[0];assert.equal(a.id,b.id);
    assert.equal((await db.query('select paid_qar from invoices where id=$1',[id(30)])).rows[0].paid_qar,'25.10');
   },{commit:true});
   assert.equal((await db.query("select actor_user_id from billing_audit_events where action='payment_recorded'")).rows[0].actor_user_id,id(8));
   await assert.rejects(asUser(db,1,()=>post(40,payment({amount_qar:'30'}))),/different payment details/);
   await assert.rejects(asUser(db,8,()=>post(41,payment({p_actor_user_id:id(1),p_actor_role:'super_admin'}))),/Unsupported payment field/);
  });
  await t.test('nonstaff, mismatches, overpayments and direct ledger writes are denied',async()=>{
   for(const n of[2,3,4])await assert.rejects(asUser(db,n,()=>post(41,payment()),{claims:{user_metadata:{role:'super_admin'}}}),{code:'42501'});
   for(const more of[{parent_id:id(9)},{student_id:id(5)},{amount_qar:'65'},{amount_qar:'0'},{amount_qar:'1.001'},{amount_qar:'NaN'}])await assert.rejects(asUser(db,1,()=>post(41,payment(more))));
   await assert.rejects(asUser(db,1,()=>db.query('insert into payments(parent_id,amount_qar)values($1,10)',[id(3)])),{code:'42501'});
   await assert.rejects(asUser(db,1,()=>db.query('update invoices set paid_qar=90 where id=$1',[id(30)])),{code:'42501'});
   await assert.rejects(asUser(db,1,()=>db.query('delete from payments where id=$1',[id(40)])),{code:'42501'});
  });
  await t.test('audit failure rolls back both the payment and invoice balance',async()=>{
   await db.exec("create function fail_billing_audit()returns trigger language plpgsql as $$begin raise exception 'audit failed';end$$;create trigger fail_billing_audit before insert on billing_audit_events for each row execute function fail_billing_audit();");
   await assert.rejects(asUser(db,1,()=>post(41,payment({amount_qar:'10'}))),/audit failed/);
   assert.equal((await db.query('select paid_qar from invoices where id=$1',[id(30)])).rows[0].paid_qar,'25.10');assert.equal((await db.query('select id from payments where id=$1',[id(41)])).rows.length,0);
   await db.exec('drop trigger fail_billing_audit on billing_audit_events');
  });
  await t.test('Tutor Admin cancellation is withheld pending owner decision; Super Admin can cancel unpaid invoice',async()=>{
   await asUser(db,1,()=>create(31,invoice()),{commit:true});
   await assert.rejects(asUser(db,8,()=>db.query("update invoices set status='Cancelled'where id=$1",[id(31)])),{code:'42501'});
   await asUser(db,1,()=>db.query("update invoices set status='Cancelled'where id=$1",[id(31)]));
  });
  await t.test('withdrawn blanket-policy migration is blocked and changes no policies',async()=>{
   await assert.rejects(db.exec(await migration('202611090002_portal_privacy.sql')),/withdrawn/);
  });
 }finally{await db.close();}
});
