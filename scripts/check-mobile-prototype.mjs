import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';

const html=await readFile(resolve('dist/learnwise-mobile-prototype.html'),'utf8');
assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+(?:stylesheet|modulepreload)/i,'Standalone file contains its assets');
const code=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(code,'Inline module exists');
const dom=new JSDOM(html.replace(/<script type="module">[\s\S]*?<\/script>/,''),{url:'https://prototype.invalid/mobile-prototype.html',pretendToBeVisual:true});
let requests=0;
const descriptors=new Map();
for(const[key,value]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,sessionStorage:dom.window.sessionStorage,MutationObserver:dom.window.MutationObserver,fetch:async()=>{requests++;throw new Error('Prototype must not use network');}})){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
const settle=()=>new Promise(resolve=>setTimeout(resolve,60));
try{
  const directory=await mkdtemp(join(tmpdir(),'learnwise-mobile-'));
  const modulePath=join(directory,'prototype.mjs');await writeFile(modulePath,code);
  await import(pathToFileURL(modulePath).href);await settle();
  assert.match(document.querySelector('main').textContent,/Ready for today/);
  for(const[role,expected]of [['parent',/Their next steps/],['tutor',/Your teaching day/]]){
    window.history.replaceState({},'',`#role=${role}&screen=home&child=maya`);window.dispatchEvent(new dom.window.PopStateEvent('popstate'));await settle();assert.match(document.querySelector('main').textContent,expected);
  }
  assert.equal(requests,0);
  console.log(JSON.stringify({standalone:true,roles:['student','parent','tutor'],networkRequests:requests,rendered:true}));
}finally{dom.window.close();for(const[key,descriptor]of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
