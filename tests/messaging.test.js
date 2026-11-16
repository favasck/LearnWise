import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {mergeMessages} from '../src/services/messaging.js';

test('message refresh merges and deduplicates conversation pages',()=>{
  const a={id:'a',created_at:'2026-01-01',read_at:null},b={id:'b',created_at:'2026-01-02'};
  assert.deepEqual(mergeMessages([b,a],[{...a,read_at:'2026-01-03'}]),[{...a,read_at:'2026-01-03'},b]);
});

test('private messaging enforces participants, receipts and account status',async t=>{
 const db=new PGlite();const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
 async function as(n,fn,commit=false,role='authenticated'){
  await db.exec('begin');
  try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[n?id(n):'']);await db.exec(`set local role ${role}`);const r=await fn();await db.exec(commit?'commit':'rollback');return r;}
  catch(e){await db.exec('rollback');throw e;}
 }
 const q=(sql,args=[])=>db.query(sql,args);
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  await db.exec(await readFile(new URL('../migrations/202611070001_bootstrap_schema.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../docs/sql/direct_messages.sql',import.meta.url),'utf8'));
  for(const n of [1,2,3,4])await q('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id(n),`${n}@test.invalid`,{}]);
  await q("update profiles set status='Suspended' where id=$1",[id(4)]);
  const send=(from,to,body='Hello')=>q('insert into direct_messages(sender_id,recipient_id,body) values($1,$2,$3) returning *',[id(from),id(to),body]);
  const m=(await as(1,()=>send(1,2),true)).rows[0];
  await t.test('only participants can read, including through the inbox RPC',async()=>{
   for(const n of [1,2])assert.equal((await as(n,()=>q('select * from direct_messages'))).rows.length,1);
   assert.equal((await as(3,()=>q('select * from direct_messages'))).rows.length,0);
   assert.equal((await as(3,()=>q('select * from message_inbox()'))).rows.length,0);
   const inbox=(await as(2,()=>q('select * from message_inbox()'))).rows[0];assert.equal(inbox.peer_id,id(1));assert.equal(Number(inbox.unread),1);
  });
  await t.test('cannot impersonate, self-message, send empty text or contact suspended users',async()=>{
   for(const fn of [()=>as(3,()=>send(1,2)),()=>as(1,()=>send(1,1)),()=>as(1,()=>send(1,2,'  ')),()=>as(1,()=>send(1,2,'x'.repeat(4001))),()=>as(1,()=>send(1,4)),()=>as(4,()=>send(4,1))])await assert.rejects(fn());
  });
  await t.test('only the recipient may mark read; content and participants are immutable',async()=>{
   const mark=()=>q('update direct_messages set read_at=now() where id=$1 returning id',[m.id]);
   assert.equal((await as(1,mark)).rows.length,0);assert.equal((await as(3,mark)).rows.length,0);
   assert.equal((await as(2,mark,true)).rows.length,1);
   assert.equal(Number((await as(2,()=>q('select * from message_inbox()'))).rows[0].unread),0);
   await assert.rejects(as(1,()=>q("update direct_messages set body='changed'")),/permission denied/);
   await assert.rejects(as(2,()=>q('update direct_messages set sender_id=$1',[id(3)])),/permission denied/);
   await assert.rejects(as(1,()=>q('delete from direct_messages')),/permission denied/);
  });
  await t.test('directory excludes self and inactive users and exposes no email',async()=>{
   const rows=(await as(1,()=>q('select * from message_contacts()'))).rows;
   assert.deepEqual(rows.map(r=>r.id).sort(),[id(2),id(3)]);
   assert.deepEqual(Object.keys(rows[0]).sort(),['full_name','id','role']);
   await assert.rejects(as(null,()=>q('select * from message_contacts()'),false,'anon'),/permission denied/);
   assert.equal((await as(4,()=>q('select * from message_contacts()'))).rows.length,0);
  });
  await q("update profiles set status='Suspended' where id=$1",[id(1)]);
  assert.equal((await as(1,()=>q('select * from direct_messages'))).rows.length,0);
 }finally{await db.close();}
});
