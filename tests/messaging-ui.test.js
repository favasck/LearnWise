import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer as http} from 'node:http';
import {createServer} from 'vite';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';

test('inbox opens users, marks incoming messages read and preserves a failed draft',async()=>{
 const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-message-tests',ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:{server:http()}},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/portal/inbox',pretendToBeVisual:true});
 const saved=new Map();for(const key of ['window','document','navigator','HTMLElement','Event','MouseEvent','IS_REACT_ACT_ENVIRONMENT']){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value:key==='IS_REACT_ACT_ENVIRONMENT'?true:dom.window[key],configurable:true,writable:true});}
 let root;
 try{
  const {createRoot}=await import('react-dom/client');const {default:Inbox}=await server.ssrLoadModule('/src/features/Inbox.jsx');
  const writes=[],receipts=[];let selected;
  const service={contacts:async()=>({data:[{id:'other',full_name:'Sara Tutor',role:'tutor'}]}),inbox:async()=>({data:[]}),thread:async()=>({data:[{id:'incoming',sender_id:'other',recipient_id:'me',body:'Hello learner',created_at:'2026-11-01T12:00:00Z',read_at:null}]}),markRead:async(user,ids)=>{receipts.push({user,ids});return{};},send:async(from,to,body,id)=>{writes.push({from,to,body,id});return writes.length===1?{error:{message:'Offline'}}:{data:{id,sender_id:from,recipient_id:to,body,created_at:'2026-11-01T12:05:00Z'}};}};
  root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(Inbox,{userId:'me',service,onPeerChange:id=>selected=id})));
  const button=document.querySelector('[aria-label="Message Sara Tutor"]');assert.ok(button);
  await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  assert.equal(selected,'other');assert.match(document.body.textContent,/Hello learner/);assert.deepEqual(receipts[0],{user:'me',ids:['incoming']});
  const field=document.querySelector('textarea');await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(field,'A question about homework');field.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  const submit=()=>act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
  await submit();assert.equal(field.value,'A question about homework');assert.match(document.body.textContent,/could not be sent/);
  await submit();assert.equal(field.value,'');assert.equal(writes[0].id,writes[1].id);assert.match(document.querySelector('ol').textContent,/A question about homework/);
 }finally{
  if(root)await act(async()=>root.unmount());await server.close();dom.window.close();for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
 }
});
