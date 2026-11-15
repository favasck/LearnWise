import {test} from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {createServer as httpServer} from 'node:http';

test('parent roster groups siblings, hides unused placeholders and saves actual names',async()=>{
  const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-parent-tests',ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:{server:httpServer()}},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'});
  const saved=new Map();
  for(const key of ['window','document','HTMLElement','IS_REACT_ACT_ENVIRONMENT']){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:dom.window[key]});}
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  let root;
  const parents=[{id:'pa',full_name:'Parent of Child A',is_placeholder:true,status:'Active'},{id:'pb',full_name:'Parent of Child B',is_placeholder:true,status:'Active'},{id:'unused',full_name:'Parent of Old Entry',is_placeholder:true,status:'Active'}];
  const students=[{id:'sa',full_name:'Child A',parent_id:'pa',grade:'Year 4',school:'Test School'},{id:'sb',full_name:'Child B',parent_id:'pb',grade:'Year 6'}];
  const writes=[];
  const service={getParents:async()=>({data:structuredClone(parents)}),getStudents:async()=>({data:structuredClone(students)}),updateParent:async(id,payload)=>{writes.push(['parent',id,payload]);const row=parents.find(p=>p.id===id);Object.assign(row,payload);return {data:structuredClone(row)};},updateStudent:async(id,payload)=>{writes.push(['student',id,payload]);const row=students.find(s=>s.id===id);Object.assign(row,payload);return {data:structuredClone(row)};}};
  const click=async el=>{assert.ok(el);await act(async()=>el.click());};
  try{
    const {createRoot}=await import('react-dom/client');const {AdminParents}=await server.ssrLoadModule('/src/App.jsx');
    root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(AdminParents,{service})));
    assert.match(document.body.textContent,/Parent of Child A/);assert.match(document.body.textContent,/Parent of Child B/);
    assert.doesNotMatch(document.body.textContent,/Parent of Old Entry/);assert.match(document.body.textContent,/Year 4 · Test School/);
    await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Edit'));
    const name=[...document.querySelectorAll('input')].find(input=>input.placeholder==='Add the actual name now or later');
    await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(name,'Actual Parent');name.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
    const sibling=[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Child B')).querySelector('input');assert.equal(sibling.disabled,false);await click(sibling);
    await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Save Changes'));
    assert.equal(writes.length,0);assert.match(document.body.textContent,/previous parent links will be replaced/);
    await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Move Students'));
    assert.equal(writes.find(w=>w[0]==='parent')[2].full_name,'Actual Parent');
    assert.equal(writes.find(w=>w[0]==='parent')[2].is_placeholder,false);
    assert.deepEqual(writes.find(w=>w[0]==='student'),['student','sb',{parent_id:'pa'}]);
    assert.match(document.body.textContent,/Parent of Child A, Child B/);assert.match(document.body.textContent,/Actual Parent/);
    assert.equal([...document.querySelectorAll('button')].filter(b=>b.textContent==='Edit').length,1);
  }finally{
    if(root)await act(async()=>root.unmount());await server.close();dom.window.close();
    for(const [key,desc] of saved){if(desc)Object.defineProperty(globalThis,key,desc);else delete globalThis[key];}
  }
});
