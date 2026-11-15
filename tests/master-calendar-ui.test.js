import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

test('master calendar filters, tutor edits, retries and shared-date restoration work through the interface',async t=>{
  const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-master-calendar-tests',ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:{server:createHttpServer()}},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const dom=new JSDOM('<html><body><div id="test-root"></div></body></html>',{url:'http://localhost/portal/calendar',pretendToBeVisual:true});
  const saved=new Map();for(const key of ['window','document','navigator','HTMLElement','Event','MouseEvent','IS_REACT_ACT_ENVIRONMENT']){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value:key==='IS_REACT_ACT_ENVIRONMENT'?true:dom.window[key],configurable:true,writable:true});}
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  const {createRoot}=await import('react-dom/client');let root;
  const mount=async element=>{if(root)await act(async()=>root.unmount());root=createRoot(document.getElementById('test-root'));await act(async()=>root.render(element));};
  const click=async element=>{assert.ok(element,'Click target exists');await act(async()=>element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,button:0})));};
  const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
  const checkbox=text=>[...document.querySelectorAll('label')].find(l=>l.textContent===text)?.querySelector('input[type="checkbox"]');
  const input=async(label,value)=>{const l=[...document.querySelectorAll('label')].find(l=>l.textContent.replace(' *','').trim()===label);assert.ok(l,`Label: ${label}`);const control=document.getElementById(l.htmlFor);const prototype=control.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:control.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;await act(async()=>{Object.getOwnPropertyDescriptor(prototype,'value').set.call(control,value);control.dispatchEvent(new dom.window.Event('input',{bubbles:true}));control.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});};
  const submit=async()=>act(async()=>document.querySelector('dialog form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
  const emptyService=()=>({getMasterCalendarEntries:async()=>({data:[]}),getClasses:async()=>({data:[]}),getStudentExams:async()=>({data:[]}),getBookingRequests:async()=>({data:[]}),getHomework:async()=>({data:[]})});
  try{
    const {default:MasterCalendar}=await server.ssrLoadModule('/src/features/MasterCalendar.jsx');
    await t.test('Qatar recurring dates are available in years beyond the exam catalogue',async()=>{
      await mount(React.createElement(MasterCalendar,{role:'tutor',userId:'tutor',service:emptyService()}));await input('Master calendar month','2032-12');await input('Calendar view','agenda');
      assert.match(document.querySelector('[aria-label="Calendar agenda"]').textContent,/Qatar National Day/);
    });
    await t.test('combined view includes classes, student exams and homework; type and board filters combine',async()=>{
      let destination;
      const service={...emptyService(),getMasterCalendarEntries:async()=>({data:[{id:'shared',title:'Board Biology',category:'Exam',visibility:'shared',board:'Cambridge',starts_on:'2030-01-02',ends_on:'2030-01-02',all_day:true,version:1}]}),getClasses:async()=>({data:[{id:'class',student:{full_name:'Class Learner'},subject:'Math',scheduled_at:'2030-01-02T08:00Z',duration_min:60}]}),getStudentExams:async()=>({data:[{id:'exam',student:{full_name:'Exam Learner'},title:'School physics',scheduled_at:'2030-01-03T08:00Z',duration_min:90}]}),getHomework:async()=>({data:[{id:'homework',title:'Homework worksheet',due_at:'2030-01-04T08:00Z'}]})};
      await mount(React.createElement(MasterCalendar,{role:'tutor',userId:'tutor',service,onNavigate:path=>{destination=path;}}));
      await input('Master calendar month','2030-01');await input('Calendar view','agenda');
      const agenda=()=>document.querySelector('[aria-label="Calendar agenda"]');assert.match(agenda().textContent,/Class Learner/);assert.match(agenda().textContent,/Exam Learner/);assert.match(agenda().textContent,/Homework worksheet/);
      await click(button('Clear types'));assert.equal(agenda().textContent,'');
      await click(checkbox('Classes'));await click(checkbox('Exam dates'));await input('Exam board','Cambridge');
      assert.match(agenda().textContent,/Class Learner/);assert.match(agenda().textContent,/Board Biology/);assert.doesNotMatch(agenda().textContent,/School physics|Homework worksheet/);
      await input('Search calendar','Class Learner');await click(agenda().querySelector('button'));await click(button('Manage in Classes'));assert.equal(destination,'/portal/myclasses');
    });
    await t.test('failed task save retains the form and retries with private visibility',async()=>{
      const writes=[];let entries=[];
      const service={...emptyService(),getMasterCalendarEntries:async()=>({data:entries}),saveMasterCalendarEntry:async(values,event)=>{writes.push({values,event});if(writes.length===1)return{error:{message:'Network interrupted'}};entries=[{...values,id:'task',owner_user_id:'tutor',version:1}];return{data:entries[0]};}};
      await mount(React.createElement(MasterCalendar,{role:'tutor',userId:'tutor',service}));await click(button('Add calendar entry'));
      await input('Event title','Prepare lesson');await input('Date','2030-01-06');await input('Event notes','Review worksheet');await submit();
      assert.match(document.querySelector('dialog').textContent,/Network interrupted/);assert.equal(document.querySelector('dialog input[maxlength="220"]').value,'Prepare lesson');
      await submit();assert.equal(writes[1].values.visibility,'private');assert.equal(writes[1].values.owner_user_id,undefined);assert.equal(writes[1].values.ends_on,'2030-01-06');assert.match(document.body.textContent,/Calendar entry saved/);
    });
    await t.test('removing and restoring a published shared date uses a retained override',async()=>{
      let entries=[];const writes=[];
      const service={...emptyService(),getMasterCalendarEntries:async()=>({data:entries}),saveMasterCalendarEntry:async(values,event)=>{writes.push({values,event});entries=[{...values,catalog_key:event.catalog_key,id:'override',owner_user_id:'tutor',version:(entries[0]?.version||0)+1}];return{data:entries[0]};}};
      await mount(React.createElement(MasterCalendar,{role:'tutor',userId:'tutor',service}));await input('Master calendar month','2026-12');await input('Calendar view','agenda');
      const agenda=()=>document.querySelector('[aria-label="Calendar agenda"]');await click([...agenda().querySelectorAll('button')].find(b=>b.textContent.includes('Qatar National Day')));
      await click(button('Remove shared date for everyone'));assert.equal(writes[0].event.origin,'catalog');assert.ok(writes[0].values.deleted_at);assert.doesNotMatch(agenda().textContent,/Qatar National Day/);
      await click(checkbox('Include removed master entries for restoration'));await click([...agenda().querySelectorAll('button')].find(b=>b.textContent.includes('Qatar National Day')));await click(button('Restore entry'));
      assert.equal(writes[1].event.origin,'calendar');assert.equal(writes[1].values.deleted_at,null);assert.equal(agenda().querySelectorAll('button').length,1);
    });
    await t.test('families have read-only master dates and failed loads never enable writes',async()=>{
      await mount(React.createElement(MasterCalendar,{role:'parent',userId:'parent',service:emptyService()}));assert.equal(button('Add calendar entry'),undefined);
      const service={...emptyService(),getMasterCalendarEntries:async()=>({error:{message:'Unavailable'}})};
      await mount(React.createElement(MasterCalendar,{role:'tutor',userId:'tutor',service}));assert.match(document.querySelector('[role="alert"]').textContent,/Unavailable/);assert.equal(button('Add calendar entry').disabled,true);
    });
  }finally{if(root)await act(async()=>root.unmount());await server.close();dom.window.close();for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});

