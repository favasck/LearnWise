import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {billingRequest} from '../src/services/billingRequest.js';
import {createPortalClient} from '../src/services/portalClient.js';
import {createClient} from '@supabase/supabase-js';
test('uncertain billing requests retain the same ID across reloads without storing personal fields',async()=>{
 const data=new Map();const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const calls=[];let fail=true;
 const action=async(payload,id)=>{calls.push(id);return fail?{data:null,error:{message:'timeout'}}:{data:{id},error:null};};
 const payload={parent_id:'parent',amount_qar:'10.00',notes:'Private information'};
 await billingRequest('payment','actor',{...payload,amount_qar:'010'},action,storage,webcrypto);
 assert.equal(data.size,1);assert.ok(!JSON.stringify([...data]).includes('Private information'));
 fail=false;
 await billingRequest('payment','actor',payload,action,storage,webcrypto);
 assert.equal(calls[0],calls[1]);assert.equal(data.size,0);
 await billingRequest('payment','actor',payload,action,storage,webcrypto);
 assert.notEqual(calls[1],calls[2]);
});
test('blocked durable storage prevents a billing request from starting',async()=>{
 let called=false;
 const result=await billingRequest('invoice','actor',{subtotal_qar:'10'},()=>{called=true;},{getItem(){throw Error('blocked');}},webcrypto);
 assert.equal(called,false);assert.ok(result.error);
});
test('actor and operation scopes cannot reuse each other\'s pending request IDs',async()=>{
 const data=new Map();const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const ids=[];const action=async(p,id)=>{ids.push(id);return {error:{message:'timeout'}};};
 await billingRequest('payment','one',{},action,storage,webcrypto);
 await billingRequest('payment','two',{},action,storage,webcrypto);
 await billingRequest('invoice','one',{},action,storage,webcrypto);
 assert.equal(new Set(ids).size,3);
});
test('real PostgREST client reads protected views, embeds protected relationships and writes base IDs only',async()=>{
 const requests=[];
 const client=createPortalClient(createClient('https://example.supabase.co','public-test-key',{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:async(url,options)=>{requests.push({url:new URL(url),options});return new Response('[]',{status:200,headers:{'content-type':'application/json'}});}},
 }));
 await client.from('students').select('*,parent:parents(id,full_name),student_tutors(tutor:tutors(id,rate_qar))').eq('id','test');
 assert.equal(requests[0].url.pathname,'/rest/v1/portal_students');
 assert.equal(requests[0].url.searchParams.get('select'),'*,parent:portal_parents(id,full_name),student_tutors(tutor:portal_tutors(id,rate_qar))');
 await client.from('students').update({full_name:'Updated'}).eq('id','test').select().single();
 assert.equal(requests[1].url.pathname,'/rest/v1/students');assert.equal(requests[1].url.searchParams.get('select'),'id');assert.equal(requests[1].options.method,'PATCH');
 await client.rpc('record_payment',{p_request_id:'request',p_payment:{amount_qar:'10'}});
 assert.equal(requests[2].url.pathname,'/rest/v1/rpc/record_payment');
});
