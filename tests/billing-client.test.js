import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {billingRequest} from '../src/services/billingRequest.js';
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
