import {test} from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {createServer as httpServer} from 'node:http';
import {mobileDestinations,activeMobileDestination} from '../src/features/mobileNavigation.js';

test('mobile destinations keep role-specific links and place secondary sections in More',()=>{
  const nav=['dashboard','myclasses','homework','progress','classes','learning','mystudents','payments'].map(key=>({key}));
  assert.deepEqual(mobileDestinations(nav,'parent').map(item=>item.key),['dashboard','classes','learning']);
  assert.equal(activeMobileDestination('progress','parent',mobileDestinations(nav,'parent')),'learning');
  assert.equal(activeMobileDestination('payments','parent',mobileDestinations(nav,'parent')),'more');
  assert.deepEqual(mobileDestinations(nav,'super_admin'),[]);
  assert.deepEqual(mobileDestinations([{key:'dashboard'}],'student').map(item=>item.key),['dashboard']);
});

test('applied mobile portal navigation, lesson pages, calendars and real service workflows',async t=>{
  const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-mobile-portal-tests',ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:{server:httpServer()}},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/portal/myclasses',pretendToBeVisual:true});
  dom.window.matchMedia=query=>({matches:!query.includes('min-width'),addEventListener(){},removeEventListener(){}});
  dom.window.scrollTo=()=>{};
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  const descriptors=new Map();
  for(const key of ['window','document','HTMLElement','PopStateEvent','requestAnimationFrame','IS_REACT_ACT_ENVIRONMENT']){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value:key==='IS_REACT_ACT_ENVIRONMENT'?true:key==='requestAnimationFrame'?dom.window.requestAnimationFrame.bind(dom.window):dom.window[key],configurable:true,writable:true});}
  let root;
  try{
    const {createRoot}=await import('react-dom/client');
    const {default:Shell}=await server.ssrLoadModule('/src/features/PortalShell.jsx');
    const {default:LessonList}=await server.ssrLoadModule('/src/features/LessonList.jsx');
    const {default:SessionCalendar}=await server.ssrLoadModule('/src/features/SessionCalendar.jsx');
    const {TutorClassNotes,TutorMyClasses,ParentPayments,ParentLearning,ParentDashboard}=await server.ssrLoadModule('/src/App.jsx');
    const {FamilySelectionProvider}=await server.ssrLoadModule('/src/features/FamilySelection.jsx');
    const mount=async(Component,props,path='/portal/myclasses')=>{if(root)await act(async()=>root.unmount());window.history.replaceState({},'',path);root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(Component,props)));};
    const click=async element=>{assert.ok(element,'Click target exists');await act(async()=>element.click());};
    const button=text=>[...document.querySelectorAll('button')].find(button=>button.textContent===text);
    const change=async(control,value)=>{assert.ok(control);const prototype=control.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:control.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;await act(async()=>{Object.getOwnPropertyDescriptor(prototype,'value').set.call(control,value);control.dispatchEvent(new dom.window.Event(control.tagName==='SELECT'?'change':'input',{bubbles:true}));});};
    const field=label=>{const node=[...document.querySelectorAll('label')].find(node=>node.textContent.replace(' *','').trim()===label);return node&&document.getElementById(node.htmlFor);};
    const ok=data=>Promise.resolve({data,error:null});
    const lesson={id:'class',student_id:'s',student:{full_name:'Learner'},subject:'Mathematics',topic:'Algebra',status:'Scheduled',attendance:'Pending',scheduled_at:'2099-01-01T10:00:00Z',duration_min:60,mode:'Online',meeting_link:'https://example.test/meeting'};
    await t.test('bottom navigation opens More and restores focus; keyboard state does not cover fields',async()=>{
      const viewport=new dom.window.EventTarget();viewport.height=dom.window.innerHeight;Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});
      const Icon=()=>null;const destinations=['dashboard','classes','learning','payments','profile'].map(key=>({key,label:key,icon:Icon}));
      const moves=[];
      await mount(Shell,{nav:destinations,role:'parent',roleLabel:'Parent',current:'progress',setCurrent:key=>moves.push(key),onLogout:()=>{},who:'Parent',children:React.createElement('input',{'aria-label':'Test field'})});
      const mobile=document.querySelector('[aria-label="Mobile primary navigation"]');assert.equal(mobile.querySelector('[aria-current="page"]').textContent,'Learning');
      await click(mobile.querySelector('a[href="/portal/classes"]'));assert.equal(moves.at(-1),'classes');
      const more=mobile.querySelector('button');more.focus();await click(more);assert.equal(document.querySelector('dialog').hasAttribute('open'),true);
      await click(document.querySelector('[aria-label="Close portal navigation"]'));assert.equal(document.activeElement,more);
      await act(async()=>document.querySelector('input').focus());viewport.height=300;await act(async()=>viewport.dispatchEvent(new dom.window.Event('resize')));assert.ok(document.querySelector('.portal-shell--keyboard'));
      viewport.height=dom.window.innerHeight;await act(async()=>viewport.dispatchEvent(new dom.window.Event('resize')));assert.equal(document.querySelector('.portal-shell--keyboard'),null);
    });
    await t.test('lesson pages survive refresh and browser Back while preserving filters',async()=>{
      await mount(LessonList,{lessons:[lesson]},'/portal/myclasses?filter=Scheduled');await click(document.querySelector('.lesson-list button'));
      assert.equal(new URLSearchParams(window.location.search).get('lesson'),'class');assert.ok(document.querySelector('article[aria-label="Lesson details"]'));assert.equal(document.querySelector('dialog'),null);
      const url=window.location.pathname+window.location.search;await mount(LessonList,{lessons:[lesson]},url);assert.match(document.querySelector('article').textContent,/Before your lesson/);
      await click(button('← Back to lessons'));assert.ok(document.querySelector('.lesson-list'));assert.equal(window.location.search,'?filter=Scheduled');
      await click(document.querySelector('.lesson-list button'));await act(async()=>{const popped=new Promise(resolve=>window.addEventListener('popstate',resolve,{once:true}));window.history.back();await popped;});assert.ok(document.querySelector('.lesson-list'));
    });
    await t.test('mobile calendar starts in agenda and pending requests remain clearly unconfirmed',async()=>{
      const date=new Date();date.setDate(15);
      await mount(SessionCalendar,{sessions:[{...lesson,scheduled_at:date.toISOString()}],requests:[{...lesson,id:'request',kind:'Pending request',request_id:'r',scheduled_at:date.toISOString()}]});
      assert.ok(document.querySelector('[aria-label="Class agenda"]'));assert.match(document.querySelector('[aria-label="Class agenda"]').textContent,/Pending request/);assert.equal(document.querySelector('[aria-label="Monthly calendar, scroll horizontally on small screens"]'),null);
    });
    await t.test('attendance errors preserve the recorded value and feedback navigation keeps the exact lesson',async()=>{
      const writes=[];const moves=[];
      await mount(TutorMyClasses,{tutorId:'t',onNavigate:path=>moves.push(path),service:{getClasses:()=>ok([lesson]),markAttendance:async(id,value)=>{writes.push([id,value]);return writes.length===1?{error:{message:'Attendance offline'}}:{error:null};}}});
      const select=document.querySelector('.tutor-lesson-card select');assert.ok(select);await change(select,'Present');assert.match(document.querySelector('[role="alert"]').textContent,/Attendance offline/);assert.equal(select.value,'Pending');await change(select,'Present');assert.equal(select.value,'Present');await click(document.querySelector('.tutor-lesson-card a'));assert.equal(moves.at(-1),'classnotes?class=class');
    });
    await t.test('tutor reviews visibility, retains failed notes, and saves without inventing an understanding score',async()=>{
      const writes=[];let notes=[];
      const service={getClassNotes:()=>ok(notes),getClasses:()=>ok([lesson]),getStudentsByTutor:()=>ok([{id:'s',full_name:'Learner'}]),createClassNote:async payload=>{writes.push(payload);if(writes.length===1)return {error:{message:'Feedback offline'}};notes=[{...payload,id:'note',student:{full_name:'Learner'}}];return {data:notes[0],error:null};}};
      await mount(TutorClassNotes,{tutorId:'t',service},'/portal/classnotes?class=class');assert.ok(document.querySelector('form'));assert.equal(field('Student').value,'s');assert.equal(field('Understanding level').value,'');
      await change(field('Plain-language lesson summary'),'Clear working on algebra.');await change(field('What should the learner do next?'),'Practise questions 4–6.');
      await click(button('Review feedback'));assert.match(document.querySelector('[aria-label="Review lesson feedback"]').textContent,/Shared in the portal with the linked parent/);assert.equal(writes.length,0);
      await click(button('Save shared feedback'));assert.match(document.querySelector('dialog [role="alert"]').textContent,/Feedback offline/);await click(button('Keep editing'));assert.equal(field('Plain-language lesson summary').value,'Clear working on algebra.');
      await click(button('Review feedback'));await click(button('Save shared feedback'));assert.equal(writes.length,2);assert.equal(writes[1].understanding,null);assert.equal(writes[1].class_id,'class');assert.equal(writes[1].student_id,'s');assert.equal(document.querySelector('dialog'),null);assert.match(document.body.textContent,/Clear working on algebra/);
    });
    await t.test('parent Learning and invoice cards use the real records passed by the service',async()=>{
      await mount(ParentLearning,{parentId:'p',service:{getStudentsByParent:()=>ok([{id:'s',full_name:'Learner'}]),getHomework:()=>ok([{id:'h',student_id:'s',title:'Algebra practice',description:'Show your working',status:'Assigned'}]),getClassNotes:()=>ok([])}},'/portal/learning');
      assert.match(document.querySelector('[aria-label="Homework tasks"]').textContent,/Show your working/);await click(button('Feedback'));assert.match(document.body.textContent,/No progress updates yet/);
      await mount(ParentPayments,{parentId:'p',service:{getInvoices:()=>ok([{id:'i',invoice_number:'INV-1',balance_qar:25.5,total_qar:50,paid_qar:24.5}]),getPayments:()=>ok([])}},'/portal/payments');
      await click(document.querySelector('[aria-label="Open invoice INV-1"]'));assert.match(document.querySelector('dialog').textContent,/25\.50/);
    });
    await t.test('parent home changes the upcoming lesson with the selected child',async()=>{
      const service={getParentDashboardStats:()=>ok({students:[{id:'a',full_name:'Child A'},{id:'b',full_name:'Child B'}],upcomingClasses:2,pendingHomework:0,outstandingQar:0}),getUpcomingClasses:({studentId})=>ok([{...lesson,id:studentId,student_id:studentId,subject:studentId==='a'?'Mathematics':'English'}])};
      function FamilyHome(){return React.createElement(FamilySelectionProvider,null,React.createElement(ParentDashboard,{parentId:'p',service,onNavigate:()=>{}}));}
      await mount(FamilyHome,{},'/portal/dashboard');await change(document.querySelector('.family-selector select'),'b');
      assert.match(document.querySelector('[aria-label="Next lesson"]').textContent,/English/);assert.doesNotMatch(document.querySelector('[aria-label="Next lesson"]').textContent,/Mathematics/);
      assert.equal(new URLSearchParams(window.location.search).get('child'),'b');const refreshed=window.location.pathname+window.location.search;await mount(FamilyHome,{},refreshed);assert.equal(document.querySelector('.family-selector select').value,'b');assert.match(document.querySelector('[aria-label="Next lesson"]').textContent,/English/);
    });
  }finally{if(root)await act(async()=>root.unmount());await server.close();dom.window.close();for(const[key,descriptor]of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
