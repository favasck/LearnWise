import{test}from'node:test';import assert from'node:assert/strict';import{createClient}from'@supabase/supabase-js';
import{scopedClient,setFirmScope,clearFirmScope,firmPayload}from'../src/services/firmScope.js';
import{allows,visibleSection,effectiveRole}from'../src/features/firms/access.js';
import{SIGNUP_ROLES,canManagePayments,canCorrectPayments}from'../src/config/roles.js';
test('Admin is a scoped permission holder; parent/student are the only signup roles',()=>{
 assert.deepEqual(SIGNUP_ROLES,['parent','student']);assert.equal(canManagePayments({role:'admin_tutor'}),false);
 assert.equal(canCorrectPayments({role:'tutor',permissions:['correct_payments']}),true);
 const admin={role:'admin',permissions:['view_roster']};assert.equal(effectiveRole(admin),'admin_tutor');assert.equal(allows(admin,'void_invoices'),false);assert.equal(visibleSection(admin,'students'),true);assert.equal(visibleSection(admin,'payments'),false);assert.equal(visibleSection(admin,'users'),false);
});
test('firm selection scopes real Supabase reads and writes and clears across accounts',async()=>{
 const requests=[];const raw=createClient('https://example.supabase.co','test-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,options)=>{requests.push({url:new URL(url),options});return new Response('[]',{status:200,headers:{'content-type':'application/json'}});}}});
 const client=scopedClient(raw);clearFirmScope();assert.match((await client.from('students').select('*')).error.message,/Choose a firm/);assert.equal(requests.length,0);
 setFirmScope('firm-a','user-a');await client.from('students').select('*').eq('user_id','user-a');assert.equal(requests[0].url.searchParams.get('firm_id'),'eq.firm-a');
 await client.from('classes').insert({subject:'Math',firm_id:'forged'});assert.equal(JSON.parse(requests[1].options.body).firm_id,'firm-a');
 setFirmScope('firm-b','user-b');clearFirmScope('user-a');assert.equal(firmPayload({firm_id:'forged'}).firm_id,'firm-b');clearFirmScope('user-b');assert.throws(()=>firmPayload({}),/Choose a firm/);
});
