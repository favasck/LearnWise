import{test}from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{PGlite}from'@electric-sql/pglite';
import{exportedFixture}from'./helpers/exported-production-fixture.js';import{asUser,id,migration}from'./helpers/reported-production-fixture.js';
const candidate=name=>readFile(new URL('../sql/candidates/'+name,import.meta.url),'utf8');
test('firm permissions and roster onboarding against the exported permissive policies',async t=>{
 const db=new PGlite();try{
  const baseline=await exportedFixture(db);
  await t.test('every exported policy is installed, including broad legacy policies',async()=>{
   assert.equal((await db.query("select count(*)::int as n from pg_policies where schemaname='public'")).rows[0].n,baseline.policies.length);
   assert.ok(baseline.policies.some(p=>p.name==='parents_admin_all'));
   assert.ok(!baseline.policies.some(p=>p.name==='profiles: admin all'));
  });
  await t.test('the legacy audit-actor forgery is reproduced locally from the summarized body',async()=>{
   await asUser(db,8,async()=>{
    await db.query("select record_payment($1,$2,$3,null,1,'Cash','','',$4,'super_admin')",[id(22),id(3),id(4),id(1)]);
    // Inspect as the fixture owner: the real policy correctly hides audit rows
    // from Tutor Admin, even though the old definer writes the forged actor.
    await db.exec('reset role');
    assert.equal((await db.query('select actor_user_id from audit_logs')).rows[0].actor_user_id,id(1));
   });
  });
  await db.exec(await migration('202611030001_protect_profile_updates.sql'));
  await db.exec(await migration('202611090003_atomic_billing.sql'));
  await db.exec(await candidate('firm-access.sql'));await db.exec(await candidate('firm-billing.sql'));
  await t.test('new tables have RLS and anonymous users cannot read roster, membership or billing data',async()=>{
   for(const table of['firms','firm_memberships','firm_audit_events','firm_invitations','payment_adjustments'])assert.equal((await db.query('select relrowsecurity from pg_class where oid=$1::regclass',['public.'+table])).rows[0].relrowsecurity,true);
   for(const table of['students','parents','tutors','payments','firm_memberships','firm_audit_events','payment_adjustments'])assert.equal((await db.query("select has_any_column_privilege('anon',$1,'SELECT')as allowed",['public.'+table])).rows[0].allowed,false);
   for(const fn of['firm_create(text)','firm_grant(uuid,uuid,text,text[],text)','roster_add(uuid,text,text,text,uuid,uuid)','invite_accept(text)','payment_correct(uuid,text,text,uuid)'])assert.equal((await db.query("select has_function_privilege('anon',$1,'EXECUTE')as allowed",['public.'+fn])).rows[0].allowed,false);
  });
  async function run(n,fn,options={}){return asUser(db,n,fn,{commit:true,...options});}
  const rpc=async(name,args=[])=>{const r=await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})as value`,args);return r.rows[0].value;};
  let a,b,ta,tb,pa,pb,sa,sb;
  await t.test('only Super Admin creates firms and grants/revokes scoped powers',async()=>{
   await assert.rejects(run(8,()=>rpc('firm_create',['Not allowed'])),{code:'42501'});
   [a,b]=await run(1,async()=>[await rpc('firm_create',['Firm A']),await rpc('firm_create',['Firm B'])]);
   await run(7,async()=>assert.equal((await db.query('select id from firms')).rows.length,2));
   assert.deepEqual((await db.query('select role from profiles where id=any($1)order by id',[[id(1),id(7)]])).rows.map(r=>r.role),['super_admin','super_admin']);
   await run(1,async()=>{
    await rpc('firm_grant',[a,id(8),'admin',['view_roster','manage_roster','manage_tutors','manage_academic','view_billing','issue_invoices','record_payments'],'Approved Firm A admin']);
    await rpc('firm_grant',[a,id(2),'tutor',[],'Approved Firm A tutor']);await rpc('firm_grant',[b,id(6),'tutor',[],'Approved Firm B tutor']);
   });
   await assert.rejects(run(8,()=>rpc('firm_grant',[a,id(8),'admin',['correct_payments'],'Self escalation'])),{code:'42501'});
   ta=(await db.query('select id from tutors where firm_id=$1 and user_id=$2',[a,id(2)])).rows[0].id;tb=(await db.query('select id from tutors where firm_id=$1 and user_id=$2',[b,id(6)])).rows[0].id;
  });
  await t.test('tutors can add parents/students only in their firm, assigned to themselves',async()=>{
   [pa,sa]=await run(2,async()=>{const p=await rpc('roster_add',[a,'parent','Parent A','3@example.test',null,null]);return[p,await rpc('roster_add',[a,'student','Student A','4@example.test',p,null])];});
   [pb,sb]=await run(6,async()=>{const p=await rpc('roster_add',[b,'parent','Parent B','parent-b@example.test',null,null]);return[p,await rpc('roster_add',[b,'student','Student B','student-b@example.test',p,null])];});
   assert.equal((await db.query('select tutor_id from student_tutors where student_id=$1',[sa])).rows[0].tutor_id,ta);
   await run(1,()=>rpc('firm_grant',[a,id(2),'tutor',['manage_roster'],'Additional roster power']));
   await asUser(db,2,async()=>{const extra=await rpc('roster_add',[a,'student','Temporary self assignment',null,pa,null]);assert.equal((await db.query('select tutor_id from student_tutors where student_id=$1',[extra])).rows[0].tutor_id,ta);});
   await run(1,()=>rpc('firm_grant',[a,id(2),'tutor',[],'Restore ordinary tutor powers']));
   await assert.rejects(run(2,()=>rpc('roster_add',[b,'student','Intrusion','x@example.test',pb,null])),{code:'42501'});
   await assert.rejects(run(2,()=>rpc('roster_add',[a,'student','Intrusion','x@example.test',pa,tb])),{code:'42501'});
  });
  await t.test('global legacy Admin policies cannot expose another firm or unassigned records',async()=>{
   await run(8,async()=>{
    const rows=(await db.query('select id from students')).rows;assert.deepEqual(rows.map(r=>r.id),[sa]);
    assert.equal((await db.query('select id from parents where id=$1',[pb])).rows.length,0);
    assert.equal((await db.query("update students set full_name='Intrusion'where id=$1 returning id",[sb])).rows.length,0);
    assert.equal((await db.query('delete from parents where id=$1 returning id',[pa])).rows.length,0);
   });
   await assert.rejects(run(8,()=>db.query('insert into student_tutors(firm_id,student_id,tutor_id)values($1,$2,$3)',[a,sb,ta])));
  });
  await t.test('signup metadata cannot create tutors or staff; parents/students may self-register',async()=>{
   for(const[n,requested,expected]of[[100,'tutor','student'],[101,'admin_tutor','student'],[102,'super_admin','student'],[103,'parent','parent'],[104,'student','student']]){
    await db.query('insert into auth.users(id,email,raw_user_meta_data)values($1,$2,$3)',[id(n),n+'@example.test',{role:requested}]);
    assert.equal((await db.query('select role from profiles where id=$1',[id(n)])).rows[0].role,expected);
    assert.equal((await db.query('select id from tutors where user_id=$1',[id(n)])).rows.length,0);
   }
  });
  let token;
  await t.test('invitations require the right confirmed email, are single use and cannot relink accounts',async()=>{
   token=await run(2,()=>rpc('invite_create',[a,'student',sa,'4@example.test']));
   await assert.rejects(run(5,()=>rpc('invite_accept',[token])),{code:'42501'});
   await assert.rejects(run(4,()=>rpc('invite_accept',[token])),{code:'42501'});
   await db.query('update auth.users set email_confirmed_at=now()where id=$1',[id(4)]);
   assert.equal(await run(4,()=>rpc('invite_accept',[token])),a);
   await assert.rejects(run(4,()=>rpc('invite_accept',[token])),{code:'42501'});
   await assert.rejects(run(2,()=>rpc('invite_create',[a,'student',sa,'attacker@example.test'])));
   await assert.rejects(run(8,()=>db.query('update students set user_id=$1 where id=$2',[id(5),sa])),{code:'42501'});
   const parentToken=await run(2,()=>rpc('invite_create',[a,'parent',pa,'3@example.test']));await db.query('update auth.users set email_confirmed_at=now()where id=$1',[id(3)]);await run(3,()=>rpc('invite_accept',[parentToken]));
  });
  let ca,cb;
  await t.test('a parent can join a firm before their child is added without seeing other families',async()=>{
   const row=await run(2,()=>rpc('roster_add',[a,'parent','New parent','103@example.test',null,null]));
   const invitation=await run(2,()=>rpc('invite_create',[a,'parent',row,'103@example.test']));await db.query('update auth.users set email_confirmed_at=now()where id=$1',[id(103)]);await run(103,()=>rpc('invite_accept',[invitation]));
   await run(103,async()=>{assert.deepEqual((await db.query('select id from firms')).rows.map(r=>r.id),[a]);assert.equal((await db.query('select id from students')).rows.length,0);});
  });
  await t.test('students/parents see corresponding tutors; tutors cannot inject another tutor or student',async()=>{
   ca=await run(2,async()=>{const{rows}=await db.query("insert into classes(firm_id,student_id,tutor_id,subject,scheduled_at)values($1,$2,$3,'Math',now())returning id",[a,sa,ta]);return rows[0].id;});
   cb=await run(6,async()=>{const{rows}=await db.query("insert into classes(firm_id,student_id,tutor_id,subject,scheduled_at)values($1,$2,$3,'Math',now())returning id",[b,sb,tb]);return rows[0].id;});
   for(const user of[3,4])await run(user,async()=>{assert.deepEqual((await db.query('select id from tutors')).rows.map(r=>r.id),[ta]);assert.deepEqual((await db.query('select id from classes')).rows.map(r=>r.id),[ca]);});
   await assert.rejects(run(2,()=>db.query("insert into homework(firm_id,student_id,tutor_id,title)values($1,$2,$3,'Injection')",[a,sb,ta])));
   await assert.rejects(run(2,()=>db.query("insert into class_notes(firm_id,student_id,tutor_id,class_id,summary)values($1,$2,$3,$4,'Injection')",[a,sa,ta,cb])));
  });
  await t.test('public material flags never bypass firm boundaries, including anonymous callers',async()=>{
   await run(6,()=>db.query("insert into materials(firm_id,tutor_id,title,file_url,is_public)values($1,$2,'Firm B only','https://example.test/material',true)",[b,tb]));
   for(const user of[2,3,4,8])await run(user,async()=>assert.equal((await db.query("select id from materials where title='Firm B only'")).rows.length,0));
   await assert.rejects(asUser(db,null,()=>db.query('select * from materials'),{role:'anon'}),{code:'42501'});
  });
  await t.test('one student can see multiple assigned tutors, without receiving unrelated tutor access',async()=>{
   await run(1,()=>rpc('firm_grant',[a,id(6),'tutor',[],'Additional tutor for this firm']));
   const second=(await db.query('select id from tutors where firm_id=$1 and user_id=$2',[a,id(6)])).rows[0].id;
   await run(8,()=>db.query('insert into student_tutors(firm_id,student_id,tutor_id)values($1,$2,$3)',[a,sa,second]));
   await run(4,async()=>assert.deepEqual(new Set((await db.query('select id from tutors')).rows.map(r=>r.id)),new Set([ta,second])));
  });
  await t.test('expired and cross-firm invitations cannot attach accounts',async()=>{
   const raw=await run(6,()=>rpc('invite_create',[b,'student',sb,'5@example.test']));
   await db.query("update firm_invitations set expires_at=now()-interval '1 minute'where record_id=$1",[sb]);
   await db.query('update auth.users set email_confirmed_at=now()where id=$1',[id(5)]);
   await assert.rejects(run(5,()=>rpc('invite_accept',[raw])),{code:'42501'});
   await assert.rejects(run(2,()=>rpc('invite_create',[a,'student',sb,'5@example.test'])),{code:'42501'});
  });
  let inv,pay;
  await t.test('billing is firm-scoped and records a server-derived actor atomically',async()=>{
   inv=id(200);pay=id(201);
   await run(8,()=>rpc('create_invoice',[inv,{firm_id:a,parent_id:pa,student_id:sa,subtotal_qar:'100',discount_qar:'0',status:'Issued'}]));
   await run(8,()=>rpc('record_payment',[pay,{firm_id:a,parent_id:pa,student_id:sa,invoice_id:inv,amount_qar:'20',method:'Cash'}]));
   await run(8,()=>rpc('record_payment',[pay,{firm_id:a,parent_id:pa,student_id:sa,invoice_id:inv,amount_qar:'20',method:'Cash'}]));
   assert.equal((await db.query('select paid_qar from invoices where id=$1',[inv])).rows[0].paid_qar,'20.00');
   await assert.rejects(run(8,()=>rpc('create_invoice',[id(202),{firm_id:b,parent_id:pb,student_id:sb,subtotal_qar:'100',status:'Issued'}])),{code:'42501'});
   await assert.rejects(run(8,()=>rpc('payment_correct',[pay,'10','Missing delegation',id(203)])),{code:'42501'});
   await assert.rejects(run(8,()=>rpc('invoice_void',[inv,'Missing delegation'])),{code:'42501'});
   await assert.rejects(run(2,()=>rpc('record_payment',[id(204),{firm_id:a,parent_id:pa,amount_qar:'10',method:'Cash'}])),{code:'42501'});
   assert.equal((await db.query('select actor_user_id from firm_audit_events where table_name=$1 and record_id=$2',['payments',pay])).rows[0].actor_user_id,id(8));
  });
  await t.test('delegated correction/void require reasons, stay in firm and preserve immutable history',async()=>{
   await run(1,()=>rpc('firm_grant',[a,id(8),'admin',['view_roster','manage_roster','manage_academic','view_billing','issue_invoices','record_payments','void_invoices','correct_payments'],'Approved finance powers']));
   await assert.rejects(run(8,()=>rpc('payment_correct',[pay,'0','',id(203)])));
   await run(8,()=>rpc('payment_correct',[pay,'0','Duplicate receipt corrected',id(203)]));
   await run(8,()=>rpc('payment_correct',[pay,'0','Duplicate receipt corrected',id(203)]));
   assert.equal((await db.query('select amount_qar from payments where id=$1',[pay])).rows[0].amount_qar,'20.00');
   assert.equal((await db.query('select count(*)::int as n from payment_adjustments')).rows[0].n,1);
   assert.equal((await db.query('select paid_qar from invoices where id=$1',[inv])).rows[0].paid_qar,'0.00');
   await run(8,()=>rpc('invoice_void',[inv,'Invoice cancelled with approval']));
   assert.equal((await db.query('select status from invoices where id=$1',[inv])).rows[0].status,'Cancelled');
   await run(3,async()=>{const row=(await db.query('select amount_qar,original_amount_qar from payment_balances where id=$1',[pay])).rows[0];assert.equal(row.amount_qar,'0.00');assert.equal(row.original_amount_qar,'20.00');});
   for(const table of['firm_audit_events','payment_adjustments'])await assert.rejects(run(8,()=>db.query('delete from '+table)),{code:'42501'});
  });
  await t.test('audit failures roll back tutor-created records and financial corrections',async()=>{
   await run(8,()=>rpc('create_invoice',[id(205),{firm_id:a,parent_id:pa,student_id:sa,subtotal_qar:'100',status:'Issued'}]));
   await run(8,()=>rpc('record_payment',[id(206),{firm_id:a,parent_id:pa,student_id:sa,invoice_id:id(205),amount_qar:'30',method:'Cash'}]));
   await db.exec("create function reject_firm_audit()returns trigger language plpgsql as $$begin raise exception 'Injected firm audit failure';end$$;create trigger reject_firm_audit before insert on firm_audit_events for each row execute function reject_firm_audit();");
   await assert.rejects(run(2,()=>rpc('roster_add',[a,'parent','Must roll back','rollback@example.test',null,null])),/Injected firm audit failure/);
   assert.equal((await db.query("select id from parents where full_name='Must roll back'")).rows.length,0);
   await assert.rejects(run(8,()=>rpc('payment_correct',[id(206),'20','Audit rollback test',id(207)])),/Injected firm audit failure/);
   assert.equal((await db.query('select paid_qar from invoices where id=$1',[id(205)])).rows[0].paid_qar,'30.00');
   assert.equal((await db.query('select id from payment_adjustments where id=$1',[id(207)])).rows.length,0);
   await db.exec('drop trigger reject_firm_audit on firm_audit_events');
  });
  await t.test('revocation and suspension remove permissions on the next request',async()=>{
   const pending=await run(2,async()=>{const row=await rpc('roster_add',[a,'student','Pending invitation','5@example.test',pa,null]);return rpc('invite_create',[a,'student',row,'5@example.test']);});
   await run(1,()=>rpc('firm_revoke',[a,id(8),'End of assignment']));await run(8,async()=>assert.equal((await db.query('select id from students')).rows.length,0));
   await db.query("update profiles set status='Suspended'where id=$1",[id(2)]);await run(2,async()=>assert.equal((await db.query('select id from classes')).rows.length,0));
   await assert.rejects(run(5,()=>rpc('invite_accept',[pending])),{code:'42501'});
  });
 }finally{await db.close();}
});
