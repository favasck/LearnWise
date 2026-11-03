import { JSDOM } from 'jsdom';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Execute the built JavaScript in an isolated DOM, never a user's browser or
// account. All application fetches are blocked after downloading public assets.
const source = process.argv[2] || 'dist';
let entry;
if (source.startsWith('https://')) {
  const response = await fetch(source);
  const html = await response.text();
  const script = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/);
  if (!response.ok || !script) throw new Error('Application module was not accessible at the supplied URL');
  const scriptResponse = await fetch(new URL(script[1], source));
  if (!scriptResponse.ok) throw new Error('Application JavaScript could not be downloaded');
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

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:4173/', pretendToBeVisual: true,
});
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
  };
  originalError(JSON.stringify(result, null, 2));
  process.exit(result.rendered && !result.loading && !errors.length ? 0 : 1);
} catch (error) {
  originalError(JSON.stringify({ rendered: false, error: error.message }, null, 2));
  process.exit(1);
}
