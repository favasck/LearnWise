import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';

test('QA results start untested, preserve evidence in export and reset for a fresh review',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'});
  const previous={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
  const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-qa-tests',ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:{server:createHttpServer()}},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const {createRoot}=await import('react-dom/client');
  let root;let exported;
  const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
  URL.createObjectURL=blob=>{exported=blob;return 'blob:qa-report';};URL.revokeObjectURL=()=>{};
  dom.window.HTMLAnchorElement.prototype.click=function(){};
  try{
    const {default:Checklist}=await server.ssrLoadModule('/src/features/QAReleaseChecklist.jsx');
    root=createRoot(document.getElementById('root'));
    await act(async()=>root.render(React.createElement(Checklist)));
    assert.match(document.querySelector('[role="status"]').textContent,/38 not tested/);
    const status=document.querySelector('select');
    const evidence=document.querySelector('textarea');
    await act(async()=>{
      const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set;
      setter.call(evidence,'Test account A; reload passed');
      evidence.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
      evidence.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
      status.value='Failed';status.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
    });
    assert.match(document.querySelector('[role="status"]').textContent,/1 failed/);
    await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Download QA results').click());
    const report=JSON.parse(await exported.text());
    assert.equal(report.results.length,38);
    assert.equal(report.results[0].status,'Failed');
    assert.equal(report.results[0].evidence,'Test account A; reload passed');
    // Untested cases must never inherit success from a basic system check.
    assert.equal(report.results.at(-1).status,'Not Tested');
    await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));
    await act(async()=>root.render(React.createElement(Checklist)));
    assert.match(document.querySelector('[role="status"]').textContent,/38 not tested/);
  }finally{
    if(root)await act(async()=>root.unmount());
    await server.close();dom.window.close();
    Object.assign(globalThis,previous);URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;
  }
});
