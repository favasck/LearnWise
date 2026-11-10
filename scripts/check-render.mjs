import { JSDOM } from 'jsdom';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Execute the built JavaScript in an isolated DOM, never a user's browser or
// account. All application fetches are blocked after downloading public assets.
const source = process.argv[2] || 'dist';
let entry;
const routeChecks = [];
if (source.startsWith('https://')) {
  const response = await fetch(source);
  const html = await response.text();
  const script = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/);
  if (!response.ok || !script) throw new Error('Application module was not accessible at the supplied URL');
  const scriptResponse = await fetch(new URL(script[1], source));
  if (!scriptResponse.ok) throw new Error('Application JavaScript could not be downloaded');
  if (process.argv.includes('--verify-routes')) {
    for (const path of ['/about','/subjects?subject=Physics','/assessment?subject=Physics','/login','/reset-password','/portal/classes']) {
      const routeResponse = await fetch(new URL(path,source),{signal:AbortSignal.timeout(15000)});
      const routeHtml = await routeResponse.text();
      const sameModule = routeHtml.includes(script[1]);
      routeChecks.push({path,status:routeResponse.status,sameModule});
      if (!routeResponse.ok || !sameModule) throw new Error(`Direct URL failed: ${path} (${routeResponse.status})`);
    }
  }
  const directory = await mkdtemp(join(tmpdir(), 'learnwise-render-'));
  entry = join(directory, 'app.mjs');
  await writeFile(entry, await scriptResponse.text());
} else {
  const directory = resolve(source);
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  const script = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/);
  if (!script) throw new Error('Build has no application module');
  entry = join(directory, script[1].replace(/^\//, ''));
}

if (process.argv.includes('--metadata-only')) {
  const code = await readFile(entry,'utf8');
  console.log(JSON.stringify({source,backendHosts:[...new Set(code.match(/https:\/\/[a-z0-9-]+\.supabase\.co/g) || [])],uiExperience:code.includes('confident learning.'),bytes:code.length,routeChecks},null,2));
  process.exit(0);
}

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:4173/', pretendToBeVisual: true,
});
dom.window.scrollTo = () => {};
for (const name of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'MutationObserver', 'HTMLElement', 'Event', 'MouseEvent', 'location', 'WebSocket']) {
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
let blockedRequests = 0;
globalThis.fetch = async () => { blockedRequests++; throw new Error('Network disabled in render check'); };
const errors = [];
const originalError = console.error;
console.error = (...args) => {
  errors.push(args.map(value => value instanceof Error ? value.message : String(value)).join(' '));
};
dom.window.addEventListener('error', event => { errors.push(event.message); event.preventDefault(); });
try {
  await import(pathToFileURL(entry).href);
  // Poll actual render state; do not accept a temporary loading message as done.
  let text = '';
  for (let attempt = 0; attempt < 100; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 50));
    text = dom.window.document.getElementById('root').textContent.trim();
    if (text && !text.startsWith('Loading LearnWise')) break;
    if (errors.length) break;
  }
  const result = {
    rendered: !!text,
    homepage: text.includes('Smart Guidance') && !!dom.window.document.querySelector('nav'),
    unavailable: text.includes('Online services are temporarily unavailable'),
    loading: text.startsWith('Loading LearnWise'),
    blockedRequests,
    errors,
    routeChecks,
  };
  if (result.homepage) {
    const root = dom.window.document.getElementById('root');
    for (const label of ['About', 'Subjects', 'IGCSE / Edexcel', 'Online Tuition', 'Book Assessment', 'Contact', 'Home']) {
      const target = [...root.querySelectorAll('nav a')].find(element => element.textContent.trim() === label);
      if (!target) throw new Error(`Public navigation missing: ${label}`);
      target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50));
      if (!root.querySelector('nav') || !root.querySelector('footer') || errors.length) {
        throw new Error(`Public page failed to render: ${label}`);
      }
    }
    const login = [...root.querySelectorAll('a')].find(element => element.textContent.trim() === 'Login');
    if (!login) throw new Error('Login navigation missing');
    login.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 50));
    if (!root.querySelector('form') || !root.querySelector('input[type="password"]')) throw new Error('Sign-in form did not render');
    result.publicPages = 7;
    result.signInForm = true;
  }
  originalError(JSON.stringify(result, null, 2));
  process.exit(result.homepage && !result.loading && !errors.length ? 0 : 1);
} catch (error) {
  originalError(JSON.stringify({ rendered: false, error: error.message }, null, 2));
  process.exit(1);
}
