import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createPasswordRecovery, createRecoveryState } from '../src/features/auth/passwordRecovery.js';

test('recovery event arriving before React mounts is retained and cleared on account switch', () => {
  let notify;
  let unsubscribed = false;
  const store = createRecoveryState({auth:{onAuthStateChange(callback) { notify = callback; return {data:{subscription:{unsubscribe(){unsubscribed=true;}}}}; }}});
  assert.equal(notify('PASSWORD_RECOVERY',{user:{id:'learner'}}),undefined);
  assert.equal(store.getSnapshot(),'learner');
  let updates = 0;
  const unsubscribe = store.subscribe(() => updates++);
  notify('TOKEN_REFRESHED',{user:{id:'learner'}});
  assert.equal(store.getSnapshot(),'learner');
  notify('SIGNED_IN',{user:{id:'other-user'}});
  assert.equal(store.getSnapshot(),null);
  assert.equal(updates,1);
  unsubscribe(); store.stop(); assert.equal(unsubscribed,true);
});

test('password recovery uses the correct callback and refuses updates without recovery', async () => {
  const calls = [];
  const service = createPasswordRecovery({auth:{
    resetPasswordForEmail:async (...args) => { calls.push(['request',...args]); return {error:null}; },
    updateUser:async (...args) => { calls.push(['update',...args]); return {error:null}; },
  }});
  assert.equal((await service.update('new-password',false)).error.message.includes('reset link'),true);
  assert.equal(calls.length,0);
  await service.request(' learner@example.test ','https://learnwise.example');
  assert.deepEqual(calls[0],['request','learner@example.test',{redirectTo:'https://learnwise.example/'}]);
  await service.update('new-password',true);
  assert.deepEqual(calls[1],['update',{password:'new-password'}]);
  assert.ok((await createPasswordRecovery(null).request('a@example.test','https://example.test')).error);
});

test('recovery survives a same-tab refresh, expires and clears for a different account', () => {
  const values = new Map();
  const storage = {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  let notify;
  const client = {auth:{onAuthStateChange(callback){notify=callback;return {data:{subscription:{unsubscribe(){}}}};}}};
  const initial = createRecoveryState(client,{storage,now:()=>1000});
  notify('PASSWORD_RECOVERY',{user:{id:'learner'}}); initial.stop();
  const refreshed = createRecoveryState(client,{storage,now:()=>2000});
  notify('INITIAL_SESSION',{user:{id:'learner'}});
  assert.equal(refreshed.getSnapshot(),'learner');
  notify('INITIAL_SESSION',{user:{id:'different'}});
  assert.equal(refreshed.getSnapshot(),null); assert.equal(values.size,0); refreshed.stop();
  storage.setItem('learnwise.recovery',JSON.stringify({userId:'learner',expiresAt:3000}));
  const expired = createRecoveryState(null,{storage,now:()=>4000});
  assert.equal(expired.getSnapshot(),null); assert.equal(values.size,0); expired.stop();
});

test('public journeys preserve navigation, validate inputs and recover from failed submissions', async t => {
  const server = await createServer({configFile:false,cacheDir:'node_modules/.vite-ui-tests',ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:{server:createHttpServer()}},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const dom = new JSDOM('<!doctype html><html><body><div id="test-root"></div></body></html>',{url:'http://localhost/',pretendToBeVisual:true});
  const saved = new Map();
  for (const key of ['window','document','navigator','HTMLElement','Event','MouseEvent','PopStateEvent','requestAnimationFrame','IS_REACT_ACT_ENVIRONMENT']) {
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{value:key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[key]?.bind && key === 'requestAnimationFrame' ? dom.window[key].bind(dom.window) : dom.window[key],configurable:true,writable:true});
  }
  dom.window.scrollTo = () => {};
  dom.window.matchMedia = () => ({matches:false,addEventListener(){},removeEventListener(){}});
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open',''); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  // React must detect DOM input events after the test document is installed.
  const { createRoot } = await import('react-dom/client');
  let root;
  const mount = async element => {
    if (root) await act(async () => root.unmount());
    root = createRoot(document.getElementById('test-root'));
    await act(async () => root.render(element));
  };
  const click = async element => { assert.ok(element,'click target exists'); await act(async () => element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,button:0}))); };
  const submit = async () => { await act(async () => document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}))); };
  const input = async (label,value) => {
    const targetLabel = [...document.querySelectorAll('label')].find(element => element.textContent.replace(' *','').trim() === label);
    assert.ok(targetLabel,`Label exists: ${label}`);
    const control = document.getElementById(targetLabel.htmlFor);
    assert.ok(control,`Label is associated: ${label}`);
    const prototype = control.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : control.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(prototype,'value').set.call(control,value);
      control.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
      control.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
    });
  };
  try {
    const {default:App} = await server.ssrLoadModule('/src/App.jsx');
    const {AuthContext} = await server.ssrLoadModule('/src/AuthContext.jsx');
    const {PublicAssessment,PublicContact} = await server.ssrLoadModule('/src/features/publicExperience.jsx');
    const {ResetPassword} = await server.ssrLoadModule('/src/features/auth/AuthScreens.jsx');
    const {Modal} = await server.ssrLoadModule('/src/ui.jsx');
    const {default:PortalShell} = await server.ssrLoadModule('/src/features/PortalShell.jsx');
    const {useNavigation} = await server.ssrLoadModule('/src/features/navigation.jsx');
    const {default:ProfileSettings} = await server.ssrLoadModule('/src/features/ProfileSettings.jsx');
    const {default:SessionCalendar} = await server.ssrLoadModule('/src/features/SessionCalendar.jsx');
    const {default:RecordHistory} = await server.ssrLoadModule('/src/features/RecordHistory.jsx');
    const {default:BookingRequests} = await server.ssrLoadModule('/src/features/BookingRequests.jsx');
    await t.test('family booking alternative retries preserve reply and post the expected version',async()=>{
      let request={id:'request',student_id:'student',tutor_id:'tutor',student:{full_name:'Test Student'},tutor:{full_name:'Test Tutor'},subject:'Math',scheduled_at:'2030-01-02T14:00Z',preferred_times:['2030-01-02T13:00Z'],duration_min:60,mode:'Offline',location:'Building A',status:'Proposed',version:2,booking_events:[]};
      const writes=[];
      const service={getBookingRequests:async()=>({data:[request]}),getTutorAvailability:async()=>({data:[]}),getStudents:async()=>({data:[]}),getTutors:async()=>({data:[]}),getClasses:async()=>({data:[]}),getStudentExams:async()=>({data:[]}),reviewBookingRequest:async(...args)=>{writes.push(args);if(writes.length===1)return {error:{message:'Connection interrupted'}};request={...request,status:'Confirmed',version:3};return {data:'request'};}};
      await mount(React.createElement(BookingRequests,{role:'parent',service}));
      assert.match(document.body.textContent,/Accept alternative/);
      assert.doesNotMatch(document.body.textContent,/Confirm requested time/);
      await input('Optional reply','That works for us');
      await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Accept alternative'));
      assert.match(document.querySelector('[role="alert"]').textContent,/Connection interrupted/);
      assert.equal([...document.querySelectorAll('textarea')].find(e=>e.value==='That works for us')?.value,'That works for us');
      await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Accept alternative'));
      assert.equal(writes[1][0].version,2);assert.equal(writes[1][1],'accept');assert.equal(writes[1][3],'That works for us');
      assert.match(document.body.textContent,/Schedule confirmed and added to the calendar/);
    });
    await t.test('tutor sees locations and sends an alternative without confirming it',async()=>{
      const request={id:'request',student_id:'student',tutor_id:'tutor',student:{full_name:'Test Student'},subject:'Math',scheduled_at:'2030-01-02T14:00Z',preferred_times:['2030-01-02T13:00Z'],duration_min:60,mode:'Offline',location:'Building A',status:'Pending',version:1};
      const writes=[];
      const service={getBookingRequests:async()=>({data:[request]}),getTutorAvailability:async()=>({data:[]}),getStudents:async()=>({data:[]}),getTutors:async()=>({data:[]}),getClasses:async()=>({data:[{id:'nearby',tutor_id:'tutor',scheduled_at:'2030-01-02T12:00Z',duration_min:60,mode:'Offline',location:'Building A',status:'Scheduled'}]}),getStudentExams:async()=>({data:[]}),reviewBookingRequest:async(...args)=>{writes.push(args);return {data:'request'};}};
      await mount(React.createElement(BookingRequests,{role:'tutor',service}));
      assert.match(document.body.textContent,/Classes, locations and exams on this day/);
      assert.match(document.body.textContent,/Building A/);
      await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Change date, hours or mode'));
      await input('Alternative time (Qatar)','2030-01-02T18:00');
      await input('Proposed session length','150');
      await input('Proposed class mode','Online');
      await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Send alternative'));
      assert.equal(writes[0][1],'propose');assert.equal(writes[0][2].scheduled_at,'2030-01-02T15:00:00.000Z');
      assert.equal(writes[0][2].duration_min,150);assert.equal(writes[0][2].mode,'Online');assert.equal(writes[0][2].location,'');
      assert.match(document.body.textContent,/Waiting for family acceptance/);
    });
    await t.test('family books student details, fixed hours, location and two weekly days without a preferred area',async()=>{
      const writes=[];
      const service={getBookingRequests:async()=>({data:[]}),getTutorAvailability:async()=>({data:[]}),getStudents:async()=>({data:[{id:'student',full_name:'Test Learner',status:'Active',grade:'Year 10',student_tutors:[{tutor_id:'tutor',is_active:true}]}]}),getTutors:async()=>({data:[{id:'tutor',full_name:'Test Tutor',status:'Active'}]}),getClasses:async()=>({data:[]}),getStudentExams:async()=>({data:[]}),submitBookingRequest:async payload=>{writes.push(payload);return {data:'created'};}};
      await mount(React.createElement(BookingRequests,{role:'parent',service}));
      await input('Student record','student');await input('Tutor','tutor');
      assert.equal(document.getElementById([...document.querySelectorAll('label')].find(e=>e.textContent==='Student name *').htmlFor).value,'Test Learner');
      await input('Student name','Test Learner Booking');await input('Student details','Year 10 · IGCSE Math');
      await input('Subject','Math');await input('Session length','90');await input('Class mode','Offline');await input('Student location / address','Building A');
      await input('First session (Qatar)','2030-01-02T17:00');await input('Repeat','twice_weekly');
      await click([...document.querySelectorAll('label')].find(e=>e.textContent==='Friday').querySelector('input'));
      assert.doesNotMatch(document.body.textContent,/Preferred area/);
      const lengthControl=document.getElementById([...document.querySelectorAll('label')].find(e=>e.textContent==='Session length *').htmlFor);
      assert.deepEqual([...lengthControl.options].map(o=>o.textContent),['1 hour','1.5 hours','2 hours','2.5 hours','3 hours']);
      await submit();
      assert.equal(writes.length,1);assert.equal(writes[0].student_name,'Test Learner Booking');assert.equal(writes[0].student_details,'Year 10 · IGCSE Math');assert.equal(writes[0].duration_min,90);assert.equal(writes[0].location,'Building A');
      assert.equal(writes[0].recurrence.frequency,'twice_weekly');assert.deepEqual(writes[0].recurrence.weekdays,[3,5]);assert.equal(writes[0].recurrence.count,8);
    });
    await t.test('planning calendar shows pending requests and exams alongside confirmed classes',async()=>{
      let selected;
      await mount(React.createElement(SessionCalendar,{sessions:[{id:'class',student:{full_name:'Confirmed Learner'},subject:'Math',scheduled_at:'2030-01-02T08:00:00Z',duration_min:90}],requests:[{id:'request-event',request_id:'request',student:{full_name:'Pending Learner'},subject:'Physics',scheduled_at:'2030-01-02T10:00:00Z',duration_min:60,kind:'Pending'}],exams:[{id:'exam',student:{full_name:'Exam Learner'},title:'Math exam',scheduled_at:'2030-01-03T07:00:00Z',duration_min:120}],onSelectRequest:id=>{selected=id;}}));
      await input('Calendar month','2030-01');
      assert.match(document.body.textContent,/Confirmed Learner/);assert.match(document.body.textContent,/Pending Learner/);assert.match(document.body.textContent,/Exam Learner/);assert.match(document.body.textContent,/Math exam/);
      await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Review request'));assert.equal(selected,'request');
    });
    const renderApp = () => React.createElement(AuthContext.Provider,{value:{user:null,profile:null,loading:false,signOut(){},refreshProfile(){}}},React.createElement(App));
    await t.test('every role can open personal settings directly, including unlinked accounts',async () => {
      for (const role of ['super_admin','admin_tutor','tutor','parent','student']) {
        window.history.replaceState({},'','/portal/profile');
        await mount(React.createElement(AuthContext.Provider,{value:{user:{id:'profile-user',email:'user@example.test'},profile:{id:'profile-user',full_name:'Profile User',role,status:'Active'},loading:false,signOut(){},refreshProfile(){}}},React.createElement(App)));
        assert.equal(window.location.pathname,'/portal/profile');
        assert.ok(document.querySelector('form'));
        assert.match(document.querySelector('main').textContent,/Personal details/);
        assert.equal(document.querySelector('a[aria-label="Open your profile settings"]').getAttribute('href'),'/portal/profile');
        if (role === 'tutor') assert.equal(document.querySelector('a[href="/portal/users"]'),null);
      }
      window.history.replaceState({},'','/');
    });
    await t.test('profile save retries preserve edits and send only personal fields',async () => {
      const writes=[];let refreshed=0;
      const auth={user:{id:'hiba'},profile:{full_name:'Hiba Zubair',email:'hiba@example.test',role:'tutor',status:'Active'},refreshProfile:async()=>{refreshed++;}};
      await mount(React.createElement(AuthContext.Provider,{value:auth},React.createElement(ProfileSettings,{
        loadTutor:async()=>({data:{full_name:'Hiba',subjects:['Biology'],curriculum:['IGCSE']},error:null}),
        saveProfile:async payload=>{writes.push(payload);return {error:writes.length===1?{message:'Connection interrupted'}:null};},
      })));
      await input('Full name','Hiba Zubair Updated'); await input('Phone','00000000'); await submit();
      assert.match(document.querySelector('[role="alert"]').textContent,/Connection interrupted/);
      assert.equal(document.querySelector('input[autocomplete="name"]').value,'Hiba Zubair Updated');
      assert.equal([...document.querySelectorAll('label')].find(label=>label.textContent==='Account role').nextElementSibling.readOnly,true);
      await submit();
      assert.deepEqual(writes[1],{full_name:'Hiba Zubair Updated',phone:'00000000'});
      assert.equal(refreshed,1);assert.match(document.querySelector('[role="status"]').textContent,/saved/);
      assert.match(document.body.textContent,/Biology/);
    });
    await t.test('calendar preserves paired names, Qatar date and start/end times',async()=>{
      await mount(React.createElement(SessionCalendar,{sessions:[{id:'pair',student:{full_name:'Aisha & Muneera'},subject:'Biology',scheduled_at:'2026-10-17T08:00:00Z',duration_min:120},{id:'deleted',student:{full_name:'Deleted lesson'},scheduled_at:'2026-10-17T08:00:00Z',duration_min:60,deleted_at:'2026-10-18'}]}));
      await input('Calendar month','2026-10');
      assert.match(document.body.textContent,/Aisha & Muneera/);
      assert.match(document.body.textContent,/11:00–13:00/);
      assert.doesNotMatch(document.body.textContent,/Deleted lesson/);
    });
    await t.test('record history shows the retained deletion and edited fields',async()=>{
      await mount(React.createElement(RecordHistory,{table:'invoices',id:'invoice',onClose(){},loadHistory:async()=>({data:[{id:'history',action:'edited',actor_role:'admin_tutor',created_at:'2026-11-15T08:00:00Z',old_data:{total_qar:100},new_data:{total_qar:150}},{id:'deleted',action:'deleted',actor_role:'admin_tutor',created_at:'2026-11-15T09:00:00Z',old_data:{deleted_at:null},new_data:{deleted_at:'2026-11-15T09:00:00Z'}}]})}));
      assert.match(document.body.textContent,/100 → 150/);
      assert.match(document.body.textContent,/deleted/);
      assert.match(document.body.textContent,/admin tutor/);
    });
    await t.test('real links change URLs; Back and refresh preserve the page',async () => {
      await mount(renderApp());
      await click(document.querySelector('nav a[href="/subjects"]'));
      assert.equal(window.location.pathname,'/subjects');
      assert.match(document.querySelector('main').textContent,/Subjects/);
      assert.equal(document.activeElement,document.querySelector('main'));
      await mount(renderApp());
      assert.match(document.querySelector('main').textContent,/Subjects/);
      await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve,40)); });
      assert.equal(window.location.pathname,'/');
      assert.match(document.querySelector('h1').textContent,/confident learning/);
      await click(document.querySelector('[aria-label="Open navigation"]'));
      assert.equal(document.querySelector('[aria-controls="public-navigation"]').getAttribute('aria-expanded'),'true');
      await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
      assert.equal(document.querySelector('[aria-controls="public-navigation"]').getAttribute('aria-expanded'),'false');
    });
    await t.test('unknown URLs show a recovery action instead of the homepage',async () => {
      window.history.replaceState({},'','/missing-page');
      await mount(renderApp());
      assert.match(document.querySelector('main').textContent,/Page not found/);
      await click(document.querySelector('main a[href="/"]'));
      assert.equal(window.location.pathname,'/');
    });
    await t.test('expired email callbacks show a fresh-link action without exposing provider errors',async () => {
      window.history.replaceState({},'','/#error=access_denied&error_code=otp_expired&error_description=provider-detail');
      await mount(renderApp());
      assert.match(document.querySelector('main').textContent,/fresh link/);
      assert.doesNotMatch(document.body.textContent,/provider-detail/);
      await click(document.querySelector('a[href="/forgot-password"]'));
      assert.equal(window.location.pathname,'/forgot-password');
      assert.equal(window.location.hash,'');
    });
    await t.test('subject links keep the selected subject through navigation and refresh',async () => {
      window.history.replaceState({},'','/');
      await mount(renderApp());
      await click(document.querySelector('main a[href="/subjects?subject=Physics"]'));
      assert.equal(window.location.search,'?subject=Physics');
      assert.equal(document.querySelector('#subject-search').value,'Physics');
      await click(document.querySelector('main a[href="/assessment?subject=Physics"]'));
      assert.equal(window.location.pathname,'/assessment');
      await mount(renderApp());
      const selected = [...document.querySelectorAll('input[type="checkbox"]')].filter(element => element.checked);
      assert.equal(selected.length,1);
      assert.equal(selected[0].parentElement.textContent,'Physics');
    });
    await t.test('portal deep links survive refresh and mobile navigation opens and closes',async () => {
      window.history.replaceState({},'','/portal/classes');
      function PortalHarness() {
        const {route,setSection} = useNavigation();
        const nav = ['classes','reports'].map(key => ({key,label:key[0].toUpperCase()+key.slice(1),icon:() => React.createElement('svg')}));
        return React.createElement(PortalShell,{nav,current:route.section,setCurrent:setSection,roleLabel:'Admin',who:'Test admin',onLogout(){}},React.createElement('p',null,'Portal content'));
      }
      const portal = () => React.createElement(PortalHarness);
      await mount(portal());
      assert.equal(document.querySelector('aside a[aria-current="page"]').textContent,'Classes');
      await click(document.querySelector('aside a[href="/portal/reports"]'));
      assert.equal(window.location.pathname,'/portal/reports');
      await mount(portal());
      assert.equal(document.querySelector('aside a[aria-current="page"]').textContent,'Reports');
      await click(document.querySelector('[aria-label="Open portal navigation"]'));
      assert.equal(document.querySelector('dialog').open,true);
      await click(document.querySelector('dialog a[href="/portal/classes"]'));
      assert.equal(document.querySelector('dialog').open,false);
      assert.equal(window.location.pathname,'/portal/classes');
    });
    await t.test('assessment validates each step, keeps values on Back and retries one request',async () => {
      const requests = [];
      await mount(React.createElement(PublicAssessment,{submitRequest:async data => { requests.push(data); return {error:requests.length === 1 ? {message:'Offline'} : null}; }}));
      await submit();
      assert.match(document.body.textContent,/Enter the student’s name/);
      assert.equal(document.querySelectorAll('[aria-invalid="true"]').length > 0,true);
      await input('Student name','Test learner');
      await click(document.querySelector('input[type="checkbox"]'));
      await submit();
      await input('Parent / guardian name','Test guardian');
      await input('Email address','invalid');
      await submit();
      assert.match(document.body.textContent,/Enter a valid email/);
      await input('Email address','guardian@example.test');
      await submit();
      assert.match(document.body.textContent,/Does everything look right/);
      await click([...document.querySelectorAll('button')].find(element => element.textContent === 'Back'));
      assert.equal(document.querySelector('input[type="email"]').value,'guardian@example.test');
      await submit();
      await submit();
      assert.match(document.querySelector('[role="alert"]').textContent,/details are still here/);
      await submit();
      assert.equal(requests.length,2);
      assert.equal(requests[1].parent_email,'guardian@example.test');
      assert.deepEqual(requests[1].subjects,['Mathematics']);
      assert.match(document.body.textContent,/appointment is confirmed/);
      assert.match(document.querySelector('h2').textContent,/request is with us/);
    });
    await t.test('contact explains missing fields and preserves the message after an outage',async () => {
      let calls = 0;
      await mount(React.createElement(PublicContact,{submitRequest:async () => {calls++; return {error:{message:'Offline'}};}}));
      await submit();
      assert.equal(calls,0);
      assert.match(document.body.textContent,/Tell us how we can help/);
      await input('Name','Test sender'); await input('Email address','sender@example.test'); await input('Message','Question about tuition.');
      await submit();
      assert.equal(calls,1);
      assert.equal(document.querySelector('textarea').value,'Question about tuition.');
      assert.match(document.querySelector('[role="alert"]').textContent,/Try again/);
    });
    await t.test('dialog has a programmatic title and restores focus when closed',async () => {
      const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
      await mount(React.createElement(Modal,{title:'Edit class',onClose(){}},React.createElement('p',null,'Details')));
      const dialog = document.querySelector('dialog');
      assert.equal(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent,'Edit class');
      await act(async () => root.unmount()); root = null;
      assert.equal(document.activeElement,trigger); trigger.remove();
    });
    await t.test('reset requires a verified recovery session and checks matching passwords',async () => {
      let updates = 0;
      const auth = {updatePassword:async () => {updates++;return {error:null};}};
      const render = ready => React.createElement(AuthContext.Provider,{value:auth},React.createElement(ResetPassword,{ready,onRequest(){},onFinish(){}}));
      await mount(render(false));
      assert.equal(document.querySelector('form'),null);
      assert.match(document.body.textContent,/fresh link/);
      await mount(render(true));
      await input('New password','new-password'); await input('Confirm new password','different-password'); await submit();
      assert.equal(updates,0); assert.match(document.body.textContent,/don’t match/);
      await input('Confirm new password','new-password'); await submit();
      assert.equal(updates,1); assert.match(document.body.textContent,/password is updated/);
    });
  } finally {
    if (root) await act(async () => root.unmount());
    await server.close(); dom.window.close();
    for (const [key,descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key]; }
  }
});
