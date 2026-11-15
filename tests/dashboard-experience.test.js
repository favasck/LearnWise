import {test} from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {createServer as httpServer} from 'node:http';

test('role dashboards connect next actions, separate family totals and never hide billing failures',async t=>{
  const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-dashboard-tests',ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:{server:httpServer()}},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/portal/dashboard'});
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  dom.window.scrollTo=()=>{};
  const saved=new Map();
  for(const key of ['window','document','HTMLElement','IS_REACT_ACT_ENVIRONMENT']){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:dom.window[key]});}
  let root;
  try{
    const {createRoot}=await import('react-dom/client');
    const {ParentDashboard,ParentClasses,ParentHomework,ParentProgress,StudentDashboard,TutorDashboard,AdminDashboard,ParentPayments}=await server.ssrLoadModule('/src/App.jsx');
    const {FamilySelectionProvider}=await server.ssrLoadModule('/src/features/FamilySelection.jsx');
    const {default:LessonList}=await server.ssrLoadModule('/src/features/LessonList.jsx');
    const {useViewPreference}=await server.ssrLoadModule('/src/features/navigation.jsx');
    const mount=async(Component,props)=>{if(root)await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(Component,props)));};
    const navigated=[];const onNavigate=section=>navigated.push(section);
    const ok=data=>Promise.resolve({data,error:null});
    await t.test('parents see one family balance and child-specific profile information',async()=>{
      await mount(ParentDashboard,{parentId:'p',parentName:'Family',onNavigate,service:{getUpcomingClasses:()=>ok([]),getParentDashboardStats:()=>ok({students:[{id:'a',full_name:'Child A',grade:'Year 4'},{id:'b',full_name:'Child B',grade:'Year 6'}],upcomingClasses:4,pendingHomework:2,outstandingQar:125.5})}});
      assert.equal(document.body.textContent.split('QAR 125.50').length-1,1);
      assert.match(document.querySelector('[aria-label="Family totals"]').textContent,/all children/);
      assert.match(document.querySelector('.dashboard-children').textContent,/Child A.*Year 4.*Child B.*Year 6/);
      await act(async()=>document.querySelector('a[href="/portal/homework"]').click());assert.equal(navigated.at(-1),'homework');
    });
    const lesson={id:'lesson',status:'Scheduled',subject:'Mathematics',mode:'Online',meeting_link:'https://example.test/meeting',scheduled_at:'2099-01-01T10:00:00Z',tutor:{full_name:'Tutor'}};
    await t.test('lesson details explain preparation and never expose a cancelled meeting action',async()=>{
      await mount(LessonList,{lessons:[lesson]});
      await act(async()=>document.querySelector('.lesson-list button').click());
      assert.match(document.querySelector('[aria-label="Lesson details"]').textContent,/Before your lesson/);
      assert.equal(document.querySelector('[aria-label="Lesson details"] a').href,lesson.meeting_link);
      await mount(LessonList,{lessons:[{...lesson,status:'Cancelled'}]});
      assert.match(document.querySelector('[aria-label="Lesson details"]').textContent,/Cancelled/);
      assert.equal(document.querySelector('[aria-label="Lesson details"] a'),null);
      window.history.replaceState({},'',window.location.pathname);
    });
    await t.test('students can open their next lesson and reach earliest homework',async()=>{
      await mount(StudentDashboard,{studentId:'s',onNavigate,service:{getStudentDashboardStats:()=>ok({upcomingClasses:[lesson],pendingHomework:[],recentNotes:[]}),getUpcomingClasses:()=>ok([lesson]),getHomework:()=>ok([{id:'later',title:'Later task',due_at:'2099-02-01'},{id:'early',title:'Earlier task',due_at:'2099-01-01'}])}});
      assert.match(document.querySelector('[aria-label="Next lesson"]').textContent,/13:00.*Qatar time/);
      assert.equal(document.querySelector('a[href="https://example.test/meeting"]').target,'_blank');
      assert.ok(document.body.textContent.indexOf('Earlier task')<document.body.textContent.indexOf('Later task'));
      await act(async()=>document.querySelector('a[href="/portal/myclasses"]').click());assert.equal(navigated.at(-1),'myclasses');
    });
    await t.test('tutors see their next future lesson and a direct feedback action',async()=>{
      await mount(TutorDashboard,{tutorId:'t',onNavigate,service:{getTutorDashboardStats:()=>ok({}),getClasses:()=>ok([]),getUpcomingClasses:()=>ok([lesson]),getHomework:()=>ok([])}});
      assert.match(document.querySelector('[aria-label="Next lesson"]').textContent,/Mathematics/);
      assert.ok(document.querySelector('a[href="/portal/classnotes"]'));
    });
    await t.test('admin supplementary query errors do not appear as empty successful reports',async()=>{
      await mount(AdminDashboard,{onNavigate,service:{getAdminDashboardStats:()=>ok({}),getClasses:()=>ok([]),getUpcomingClasses:()=>ok([]),getOutstandingPaymentsReport:()=>Promise.resolve({error:{message:'Billing unavailable'}})}});
      assert.match(document.querySelector('[role="alert"]').textContent,/Billing unavailable/);
      assert.equal(document.querySelector('.dashboard-actions'),null);
    });
    await t.test('a failed payment history cannot produce a zero account summary',async()=>{
      await mount(ParentPayments,{parentId:'p',service:{getInvoices:()=>ok([]),getPayments:()=>Promise.resolve({error:{message:'Payments unavailable'}})}});
      assert.match(document.querySelector('[role="alert"]').textContent,/Payments unavailable/);
      assert.doesNotMatch(document.body.textContent,/QAR 0/);
    });
    await t.test('parents open invoice details and switch payment history with a native button',async()=>{
      await mount(ParentPayments,{parentId:'p',service:{getInvoices:()=>ok([{id:'i',invoice_number:'LW-1',student:{full_name:'Child A'},period_start:'2026-11-01',period_end:'2026-11-30',total_qar:300.75,paid_qar:100,balance_qar:200.75,status:'Partially Paid'}]),getPayments:()=>ok([])}});
      await act(async()=>document.querySelector('[aria-label="View invoice LW-1"]').click());
      assert.match(document.querySelector('dialog').textContent,/Child A/);
      assert.match(document.querySelector('dialog').textContent,/200\.75/);
      await act(async()=>document.querySelector('[aria-label="Close dialog"]').click());
      assert.equal(document.querySelector('dialog'),null);
      const payments=[...document.querySelectorAll('button')].find(b=>b.textContent==='payments');
      await act(async()=>payments.click());assert.equal(payments.getAttribute('aria-pressed'),'true');
      assert.match(document.body.textContent,/No payments recorded yet/);
    });
    await t.test('display choices survive a remount and reject unsupported URL values',async()=>{
      function Preference(){const[value,setValue]=useViewPreference('tab','invoices',['invoices','payments']);return React.createElement('button',{onClick:()=>setValue('payments')},value);}
      window.history.replaceState({},'','/portal/payments');
      await mount(Preference,{});await act(async()=>document.querySelector('button').click());
      assert.equal(window.location.search,'?tab=payments');await mount(Preference,{});assert.equal(document.querySelector('button').textContent,'payments');
      window.history.replaceState({},'','/portal/payments?tab=unknown');await mount(Preference,{});assert.equal(document.querySelector('button').textContent,'invoices');
    });
    await t.test('family child selection follows lessons, homework and feedback without mixing siblings',async()=>{
      window.history.replaceState({},'','/portal/classes');
      const children=[{id:'a',full_name:'Child A'},{id:'b',full_name:'Child B'}];
      const service={getStudentsByParent:()=>ok(children),getClasses:({studentId})=>ok([{id:studentId,student_id:studentId,status:'Scheduled',subject:`Lesson ${studentId}`,scheduled_at:'2099-01-01T10:00:00Z'}]),getHomework:({studentId})=>ok([{id:studentId,student_id:studentId,status:'Assigned',title:`Homework ${studentId}`}]),getClassNotes:({studentId})=>ok([{id:studentId,student_id:studentId,topic:`Feedback ${studentId}`,is_shared_with_parent:true}])};
      function FamilyJourney(){const[screen,setScreen]=React.useState('lessons');const Component={lessons:ParentClasses,homework:ParentHomework,feedback:ParentProgress}[screen];return React.createElement(FamilySelectionProvider,null,React.createElement('div',null,['lessons','homework','feedback'].map(name=>React.createElement('button',{key:name,onClick:()=>setScreen(name)},name)),React.createElement(Component,{parentId:'p',service})));}
      await mount(FamilyJourney,{});
      const selector=document.querySelector('.family-selector select');
      await act(async()=>{selector.value='a';selector.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
      assert.match(document.querySelector('.lesson-list').textContent,/Lesson a/);assert.doesNotMatch(document.querySelector('.lesson-list').textContent,/Lesson b/);
      await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='homework').click());
      assert.equal(document.querySelector('.family-selector select').value,'a');assert.match(document.querySelector('[aria-label="Homework tasks"]').textContent,/Homework a/);assert.doesNotMatch(document.querySelector('[aria-label="Homework tasks"]').textContent,/Homework b/);
      await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='feedback').click());
      assert.equal(document.querySelector('.family-selector select').value,'a');assert.match(document.body.textContent,/Feedback a/);assert.doesNotMatch(document.body.textContent,/Feedback b/);
    });
  }finally{if(root)await act(async()=>root.unmount());await server.close();dom.window.close();for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
