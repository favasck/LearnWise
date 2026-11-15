import {test} from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {createServer as httpServer} from 'node:http';

test('command preview, duplicate choice, save recovery and tutor boundary',async()=>{
  const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-command-tests',ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:{server:httpServer()}},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'});
  const saved=new Map();let root;
  for(const key of ['window','document','HTMLElement','IS_REACT_ACT_ENVIRONMENT']){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:dom.window[key]});}
  try {
    const {createRoot}=await import('react-dom/client');
    const {default:Box}=await server.ssrLoadModule('/src/features/StudentCommandBox.jsx');
    const rows=[{id:'old',full_name:'Naila',grade:'Year 7'}];let writes=0;
    const service={getStudents:async()=>({data:rows}),getStudentsByTutor:async()=>({data:rows}),createStudent:async payload=>{writes++;rows.push(payload);return {error:{message:'Response lost'}};}};
    const mount=async role=>{if(root)await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(Box,{role,tutorId:'t',service})));};
    const enter=async text=>{await act(async()=>{const input=document.querySelector('form input');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,text);input.dispatchEvent(new window.Event('input',{bubbles:true}));input.dispatchEvent(new window.Event('change',{bubbles:true}));});await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));};
    const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
    await mount('admin_tutor');await enter('Add student Naila, Year 8, maths');
    assert.equal(document.querySelector('input[maxlength="150"]').value,'Naila');
    assert.equal(button('Create student record').disabled,true);
    await act(async()=>document.querySelector('input[type=checkbox]').click());
    await act(async()=>button('Create student record').click());
    assert.match(document.querySelector('[role=alert]').textContent,/Response lost/);
    await act(async()=>button('Create student record').click());
    assert.equal(writes,1);assert.match(document.body.textContent,/Student record created: Naila/);
    await mount('tutor');await enter('Add student Naila');
    assert.equal(button('Create student record'),undefined);assert.match(document.body.textContent,/have not been saved/);
    await enter('Find student Naila');assert.match(document.body.textContent,/Matching students/);
    await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Year 7')).click());
    assert.match(document.querySelector('[aria-label="Selected student"]').textContent,/Year 7/);
    await mount('parent');assert.equal(document.querySelector('form'),null);
  } finally {
    if(root)await act(async()=>root.unmount());
    await new Promise(resolve=>setTimeout(resolve,10));
    await server.close();dom.window.close();
    for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
});
