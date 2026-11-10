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
    const prototype = control.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
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
    const renderApp = () => React.createElement(AuthContext.Provider,{value:{user:null,profile:null,loading:false,signOut(){},refreshProfile(){}}},React.createElement(App));
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
