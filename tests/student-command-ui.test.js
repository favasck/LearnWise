import {test} from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {createServer as httpServer} from 'node:http';

test('task cards resolve people, require previews, recover saves and confirm removal',async t=>{
  const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-command-tests',ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:{server:httpServer()}},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'});
  const saved=new Map();let root;
  for(const key of ['window','document','HTMLElement','IS_REACT_ACT_ENVIRONMENT']){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:dom.window[key]});}
  try {
    const {createRoot}=await import('react-dom/client');
    const {default:Box}=await server.ssrLoadModule('/src/features/StudentCommandBox.jsx');
    const students=[{id:'old',full_name:'Naila',grade:'Year 7'}];let writes=0,deletes=0,attendance=0;
    const lesson={id:'lesson',student_id:'old',tutor_id:'t',student:{full_name:'Naila'},subject:'Maths',scheduled_at:new Date().toISOString(),status:'Scheduled',attendance:'Pending',updated_at:'v1'};
    const ok=data=>Promise.resolve({data,error:null});
    const service={getStudents:()=>ok(students),getStudentsByTutor:()=>ok(students),getParents:()=>ok([]),getTutors:()=>ok([{id:'t',full_name:'Amal'}]),getClasses:()=>ok([lesson]),getHomework:()=>ok([{id:'h',title:'Fractions',student_id:'old',tutor_id:'t',student:{full_name:'Naila'},status:'Submitted',updated_at:'v1'}]),createStudent:async payload=>{writes++;students.push(payload);return {error:{message:'Response lost'}};},softDeleteRecord:async(table,id)=>{deletes++;assert.equal(table,'homework');assert.equal(id,'h');return {data:{id,title:'Fractions',deleted_at:'now'}};},markAttendance:async(id,value)=>{attendance++;assert.equal(id,'lesson');assert.equal(value,'Present');return {data:{...lesson,attendance:value}};}};
    const mount=async role=>{if(root)await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(Box,{role,tutorId:'t',userId:'actor',service})));};
    const enter=async text=>{await act(async()=>{const input=document.querySelector('form input');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,text);input.dispatchEvent(new window.Event('input',{bubbles:true}));input.dispatchEvent(new window.Event('change',{bubbles:true}));});await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));};
    const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
    const click=async text=>{assert.ok(button(text),text);await act(async()=>button(text).click());};
    await t.test('student create preview explains side effects and recovers a lost response',async()=>{
      await mount('admin_tutor');await enter('Add student Naila, Year 8, maths');
      assert.match(document.body.textContent,/Existing records with the same name/);
      assert.equal(document.querySelector('input[maxlength="150"]').value,'Naila');
      await click('Preview changes');assert.equal(writes,0);assert.equal(button('Confirm and save').disabled,true);
      await act(async()=>document.querySelector('.task-command-ack input').click());await click('Confirm and save');
      assert.match(document.querySelector('[role=alert]').textContent,/Response lost/);
      await click('Check and retry save');assert.equal(writes,1);assert.match(document.body.textContent,/No invitation was sent/);
    });
    await t.test('tutors keep unsaved drafts and search assigned students',async()=>{
      await mount('tutor');await enter('Add student Naila');assert.equal(button('Preview changes'),undefined);assert.match(document.body.textContent,/have not been saved/);
      await enter('Find student Naila');assert.match(document.body.textContent,/matching records/);
      const match=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Year 7'));await act(async()=>match.click());assert.match(document.querySelector('[aria-label="Selected student"]').textContent,/Year 7/);
    });
    await t.test('attendance is linked to an exact lesson and not saved before review',async()=>{
      await mount('tutor');await enter('Mark Naila present');assert.equal(attendance,0);assert.match(document.body.textContent,/Maths/);
      await click('Preview changes');assert.equal(attendance,0);await click('Confirm and save');assert.equal(attendance,1);assert.match(document.body.textContent,/Present/);
    });
    await t.test('deletion requires an explicit acknowledgement and calls retained deletion',async()=>{
      await mount('tutor');await enter('Delete homework Fractions');await click('Preview changes');assert.equal(deletes,0);assert.equal(button('Confirm and save').disabled,true);
      await act(async()=>document.querySelector('.task-command-ack input').click());await click('Confirm and save');assert.equal(deletes,1);assert.match(document.body.textContent,/retained history/);
    });
    await t.test('unsupported requests preserve typed text and produce no success',async()=>{
      await enter('Delete everything');assert.match(document.querySelector('[role=alert]').textContent,/Which record/);assert.equal(document.querySelector('form input').value,'Delete everything');
      await mount('parent');assert.equal(document.querySelector('form'),null);
    });
  } finally {
    if(root)await act(async()=>root.unmount());await new Promise(resolve=>setTimeout(resolve,10));await server.close();dom.window.close();
    for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
});
