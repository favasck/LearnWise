import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const sql=name=>readFile(new URL('../migrations/'+name,import.meta.url),'utf8');
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
test('launch migrations enforce privacy, permissions and transactional billing',async t=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for(const f of ['202611070001_bootstrap_schema.sql','202611030001_protect_profile_updates.sql','202611090001_reconcile_production_schema.sql'])await db.exec(await sql(f));
  // Simulate an old permissive policy: the upgrade must remove it, not OR it in.
  await db.exec('create policy old_everyone on students for select to authenticated using(true)');
  await db.exec('create view portal_students as select * from students; grant update(full_name) on portal_students to authenticated;');
  await db.exec(await sql('202611090002_portal_privacy.sql'));
  await db.exec('grant insert(parent_id,amount_qar),update(amount_qar) on payments to authenticated; grant insert(parent_id,invoice_number),update(paid_qar) on invoices to authenticated;');
  await db.exec(await sql('202611090003_atomic_billing.sql'));
  for(const [n,role]of [[1,'student'],[2,'tutor'],[3,'parent'],[4,'student'],[5,'parent'],[6,'student'],[7,'tutor']]){
   await db.query('insert into auth.users(id,email,raw_user_meta_data)values($1,$2,$3)',[id(n),n+'@test.invalid',{role}]);
  }
  await db.query("update profiles set role='admin'where id=$1",[id(1)]);
  for(const n of [3,5])await db.query("insert into parents(id,user_id,full_name,email,phone,address,notes)values($1,$1,'Parent','private@example.test','123','Private address','Parent secret')",[id(n)]);
  for(const n of [2,7])await db.query("insert into tutors(id,user_id,full_name,rate_qar,email,notes)values($1,$1,'Tutor',99,'tutor@example.test','Tutor secret')",[id(n)]);
  for(const [n,p]of [[4,3],[6,5]])await db.query("insert into students(id,user_id,parent_id,full_name,email,date_of_birth,notes)values($1,$1,$2,'Student','student@example.test','2010-01-01','Student secret')",[id(n),id(p)]);
  await db.query('insert into student_tutors(student_id,tutor_id)values($1,$2)',[id(4),id(2)]);
  await db.query("insert into classes(id,student_id,tutor_id,subject,scheduled_at,notes,rate_qar)values($1,$2,$3,'Math',now(),'Class secret',200)",[id(10),id(4),id(2)]);
  async function asUser(n,fn,role='authenticated',commit=false){
   await db.exec('begin');
   try{
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[n?id(n):'']);await db.exec(`set local role ${role}`);
    const r=await fn();await db.exec(commit?'commit':'rollback');return r;
   }catch(e){await db.exec('rollback');throw e;}
  }
  const invoice=(overrides={})=>({parent_id:id(3),student_id:id(4),subtotal_qar:'100.00',discount_qar:'10.00',status:'Issued',notes:'Invoice secret',...overrides});
  const payment=(overrides={})=>({parent_id:id(3),student_id:id(4),invoice_id:id(20),amount_qar:'25.10',method:'Cash',reference:'Receipt',notes:'Payment secret',...overrides});
  const createInvoice=(request,data)=>db.query('select (public.create_invoice($1,$2)).*',[id(request),data]);
  const post=(request,data)=>db.query('select (public.record_payment($1,$2)).*',[id(request),data]);
  await t.test('internal columns are inaccessible through base tables, even with explicit column requests',async()=>{
   for(const user of [1,2,3,4,5,7])for(const table of ['students','parents','tutors','classes','invoices','payments']){
    await assert.rejects(asUser(user,()=>db.query(`select notes from ${table}`)),{code:'42501'});
    await assert.rejects(asUser(user,()=>db.query(`select * from ${table}`)),{code:'42501'});
   }
  });
  await t.test('protected views mask fields and preserve legitimate row access',async()=>{
   for(const user of [2,3,4])await asUser(user,async()=>{
    const students=(await db.query('select * from portal_students')).rows;assert.equal(students.length,1);assert.equal(students[0].notes,null);
    assert.equal(students[0].email,user===2?null:'student@example.test');
    const parents=(await db.query('select * from portal_parents')).rows;assert.equal(parents.length,1);assert.equal(parents[0].notes,null);assert.equal(parents[0].address,user===3?'Private address':null);
    assert.equal((await db.query('select * from portal_classes')).rows[0].rate_qar,null);
   });
   await asUser(1,async()=>assert.equal((await db.query('select notes from portal_students limit 1')).rows[0].notes,'Student secret'));
   await asUser(7,async()=>assert.equal((await db.query('select * from portal_students')).rows.length,0));
   await asUser(5,async()=>assert.deepEqual((await db.query('select id from portal_students')).rows.map(r=>r.id),[id(6)]));
   await assert.rejects(asUser(null,()=>db.query('select * from portal_students'),'anon'),{code:'42501'});
  });
  await t.test('view writes and direct profile escalation remain denied',async()=>{
   await assert.rejects(asUser(2,()=>db.query("update portal_students set notes='forged'")),e=>['42501','0A000'].includes(e.code));
   await assert.rejects(asUser(2,()=>db.query("update portal_students set full_name='forged'")),{code:'42501'});
   await assert.rejects(asUser(4,()=>db.query("update profiles set role='admin'where id=$1",[id(4)])),{code:'42501'});
   await asUser(1,()=>db.query('select admin_update_profile($1,$2)',[id(6),{status:'Suspended'}]));
  });
  await t.test('revocation and suspension immediately remove view access',async()=>{
   await db.exec('update student_tutors set is_active=false');
   await asUser(2,async()=>assert.equal((await db.query('select * from portal_students')).rows.length,0));
   await db.exec('update student_tutors set is_active=true');
   await db.query("update profiles set status='Suspended'where id=$1",[id(3)]);
   await asUser(3,async()=>{for(const table of ['students','parents','tutors','classes','invoices','payments'])assert.equal((await db.query('select * from portal_'+table)).rows.length,0);});
   await db.query("update profiles set status='Active'where id=$1",[id(3)]);
  });
  await t.test('invoice creation computes discounted totals and is idempotent',async()=>{
   await asUser(1,async()=>{
    const a=(await createInvoice(20,invoice())).rows[0];const b=(await createInvoice(20,invoice())).rows[0];
    assert.equal(a.id,b.id);assert.equal(a.total_qar,'90.00');assert.match(a.invoice_number,/^INV-/);
    assert.equal((await db.query('select count(*)::int as n from billing_audit_events')).rows[0].n,1);
   },'authenticated',true);
   await assert.rejects(asUser(1,()=>createInvoice(20,invoice({notes:'changed'}))),/different invoice details/);
  });
  await t.test('same payment retries only once, with exact decimals and an audit event',async()=>{
   await asUser(1,async()=>{
    const a=(await post(30,payment())).rows[0];const b=(await post(30,payment())).rows[0];assert.equal(a.id,b.id);
    const inv=(await db.query('select * from portal_invoices where id=$1',[id(20)])).rows[0];
    assert.equal(inv.paid_qar,'25.10');assert.equal(inv.balance_qar,'64.90');assert.equal(inv.status,'Partially Paid');
    assert.equal((await db.query("select count(*)::int as n from billing_audit_events where action='payment_recorded'")).rows[0].n,1);
   },'authenticated',true);
   await assert.rejects(asUser(1,()=>post(30,payment({amount_qar:'30.00'}))),/different payment details/);
  });
  await t.test('mismatched, overpaid, invalid decimal and unauthorized payments are rejected',async()=>{
   for(const patch of [{parent_id:id(5)},{student_id:id(6)},{amount_qar:'65'},{amount_qar:'0'},{amount_qar:'-1'},{amount_qar:'1.001'},{amount_qar:'NaN'},{paid_at:'2000-01-01'}])await assert.rejects(asUser(1,()=>post(31,payment(patch))));
   for(const user of [2,3,4,5])await assert.rejects(asUser(user,()=>post(31,payment())),{code:'42501'});
   await assert.rejects(asUser(1,()=>db.query("update invoices set paid_qar=90 where id=$1",[id(20)])),{code:'42501'});
   await assert.rejects(asUser(1,()=>db.query('insert into payments(parent_id,amount_qar)values($1,10)',[id(3)])),{code:'42501'});
   await assert.rejects(asUser(1,()=>db.query("insert into invoices(parent_id,invoice_number)values($1,'BYPASS')",[id(3)])),{code:'42501'});
   await assert.rejects(asUser(1,()=>db.query("update invoices set status='Paid'where id=$1",[id(20)])),/Unsupported invoice transition/);
   await assert.rejects(asUser(1,()=>db.query('delete from payments where id=$1',[id(30)])),{code:'42501'});
   await assert.rejects(asUser(1,()=>db.query('delete from parents where id=$1',[id(3)])));
  });
  await t.test('an audit failure rolls back both payment and invoice balance',async()=>{
   await db.exec(`create function fail_billing_audit()returns trigger language plpgsql as $$begin raise exception 'Injected audit failure';end$$;
   create trigger test_failure before insert on billing_audit_events for each row execute function fail_billing_audit();`);
   await assert.rejects(asUser(1,()=>post(32,payment({amount_qar:'10.00'}))),/Injected audit failure/);
   assert.equal((await db.query('select paid_qar from invoices where id=$1',[id(20)])).rows[0].paid_qar,'25.10');
   assert.equal((await db.query('select id from payments where id=$1',[id(32)])).rows.length,0);
   await db.exec('drop trigger test_failure on billing_audit_events');
  });
  await t.test('settlement records final payment and hides private ledger notes from parents',async()=>{
   await asUser(1,()=>post(33,payment({amount_qar:'64.90'})),'authenticated',true);
   await asUser(3,async()=>{
    const inv=(await db.query('select * from portal_invoices')).rows[0];assert.equal(inv.status,'Paid');assert.equal(inv.balance_qar,'0.00');assert.equal(inv.notes,null);
    const payments=(await db.query('select * from portal_payments')).rows;assert.equal(payments.length,2);assert.equal(payments[0].notes,null);
   });
   await asUser(5,async()=>assert.equal((await db.query('select * from portal_payments')).rows.length,0));
  });
 }finally{await db.close();}
});
