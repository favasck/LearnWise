import {readFile,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';

const directory=resolve('dist');
let html=await readFile(resolve(directory,'mobile-prototype.html'),'utf8');
const script=html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const stylesheet=html.match(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
if(!script||!stylesheet)throw new Error('Prototype build assets are missing');
const assetPath=path=>{const resolved=resolve(directory,path.replace(/^\//,''));if(!resolved.startsWith(directory+sep))throw new Error('Asset is outside the build directory');return resolved;};
const code=await readFile(assetPath(script[1]),'utf8');
const css=await readFile(assetPath(stylesheet[1]),'utf8');
html=html.replace(script[0],()=>`<script type="module">${code.replace(/<\/script/gi,'<\\/script')}</script>`);
html=html.replace(stylesheet[0],()=>`<style>${css.replace(/<\/style/gi,'<\\/style')}</style>`);
await writeFile(resolve(directory,'learnwise-mobile-prototype.html'),html);
console.log('Self-contained prototype: dist/learnwise-mobile-prototype.html');
