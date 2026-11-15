import {test} from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {createServer as httpServer} from 'node:http';

test('mobile prototype supports all three journeys without live accounts or writes',async t=>{
  const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-prototype-tests',ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:{server:httpServer()}},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/mobile-prototype.html',pretendToBeVisual:true});
  let scrollResets=0;dom.window.matchMedia=()=>({matches:true});dom.window.scrollTo=()=>scrollResets++;
  const descriptors=new Map();
  for(const key of ['window','document','HTMLElement','sessionStorage','IS_REACT_ACT_ENVIRONMENT']){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value:key==='IS_REACT_ACT_ENVIRONMENT'?true:dom.window[key],configurable:true,writable:true});}
  let root;
  try{
    const {createRoot}=await import('react-dom/client');
    const {default:Prototype,readPrototypeRoute}=await server.ssrLoadModule('/src/prototype/MobilePrototype.jsx');
    const mount=async()=>{if(root)await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(Prototype)));};
    const main=()=>document.querySelector('main');
    const button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent===label);
    const click=async element=>{assert.ok(element,'Target exists');await act(async()=>element.click());};
    const input=async(id,value)=>{const field=document.getElementById(id);assert.ok(field);await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(field,value);field.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});};
    const go=async hash=>{await act(async()=>{window.history.pushState({},'',`#${hash}`);window.dispatchEvent(new dom.window.PopStateEvent('popstate'));});};
    await t.test('unknown route values recover to a valid student home',async()=>{
      assert.deepEqual(readPrototypeRoute('#role=admin&screen=invalid&child=unknown'),{role:'student',screen:'home',child:'maya'});
      await mount();assert.match(main().textContent,/Ready for today/);assert.equal(document.activeElement.tagName,'H1');assert.ok(scrollResets>0,'Mobile navigation resets the viewport');
    });
    await t.test('student finds lesson preparation, previews joining and returns with browser Back',async()=>{
      await click(button('View lesson & join'));assert.match(main().textContent,/Bring your questions/);assert.match(window.location.hash,/screen=lesson/);
      await click(button('Join lesson'));assert.match(main().textContent,/Meeting handoff preview/);
      await act(async()=>{const popped=new Promise(resolve=>window.addEventListener('popstate',resolve,{once:true}));window.history.back();await popped;});
      assert.match(main().textContent,/Bring your questions/);
      await click([...document.querySelectorAll('.mp-bottom-nav a')].find(a=>a.textContent==='Homework'));
      await click(document.querySelector('.mp-task-card'));assert.match(main().textContent,/questions 1–6/);
      await mount();assert.match(main().textContent,/questions 1–6/);
    });
    await t.test('parent child choice follows homework and feedback and survives a refresh',async()=>{
      await click(button('parent'));
      const select=document.querySelector('[aria-label="Choose child"]');await act(async()=>{select.value='adam';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
      await click([...document.querySelectorAll('.mp-bottom-nav a')].find(a=>a.textContent==='Learning'));
      assert.match(main().textContent,/Adam’s learning/);assert.doesNotMatch(main().textContent,/completing the square/);
      await click(button('Read learning feedback'));assert.match(main().textContent,/choosing quotations/);
      await mount();assert.equal(document.querySelector('[aria-label="Choose child"]').value,'adam');assert.match(main().textContent,/Writing with evidence/);
    });
    await t.test('tutor validates, reviews the audience and retries a failed save without losing notes',async()=>{
      await click(button('tutor'));await click(button('Record attendance & feedback'));
      await act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
      assert.match(document.querySelector('[role="alert"]').textContent,/Choose attendance/);assert.equal(document.activeElement.id,'mp-attendance');
      await click([...document.querySelectorAll('input[type="radio"]')][0]);
      await input('mp-covered','Quadratic equations, questions 1–3');await input('mp-practice','Clear working');await input('mp-next','Practise questions 4–6');
      await click(button('Review attendance & feedback'));assert.match(main().textContent,/Visible to Maya and their linked parent/);
      await click(document.querySelector('.mp-failure-toggle input'));await click(button('Save & share feedback'));
      assert.match(document.querySelector('[role="alert"]').textContent,/entries are kept/);assert.match(main().textContent,/Practise questions 4–6/);
      await click(button('Keep editing'));assert.equal(document.getElementById('mp-next').value,'Practise questions 4–6');
      await mount();assert.equal(document.getElementById('mp-next').value,'Practise questions 4–6');
      await click(button('Review attendance & feedback'));await click(button('Save & share feedback'));
      assert.match(main().textContent,/Attendance recorded. Feedback shared/);await mount();assert.match(main().textContent,/Attendance recorded. Feedback shared/);
      await click(button('parent'));await click(button('Read learning feedback'));
      assert.match(main().textContent,/Practise questions 4–6/);
      assert.match(main().textContent,/Clear working/);
    });
    await t.test('drafts do not cross learners and reset clears the demonstration',async()=>{
      await go('role=tutor&screen=feedback&child=adam');assert.equal(document.getElementById('mp-covered').value,'');assert.match(main().textContent,/Adam · English/);
      await click(button('Reset prototype'));assert.match(main().textContent,/Ready for today/);
      const records=JSON.parse(sessionStorage.getItem('learnwise.mobile-prototype.draft'));assert.equal(records.maya.covered,'');assert.equal(records.maya.saved,false);
      await go('role=tutor&screen=review&child=maya');assert.equal(button('Save & share feedback').disabled,true);
    });
  }finally{if(root)await act(async()=>root.unmount());await server.close();dom.window.close();for(const[key,descriptor]of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
