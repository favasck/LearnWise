import { createServer as createHttpServer } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('real data service settles injected failures and public writes need no read grant', async t => {
  t.mock.method(console, 'error', () => {});
  const calls = [];
  let failing = true;
  const chain = new Proxy({}, { get(_target, key) {
    if (key === 'then') return (resolve, reject) => failing
      ? Promise.reject(new TypeError('Failed to fetch')).then(resolve,reject)
      : Promise.resolve({ data: null, error: null }).then(resolve,reject);
    return (...args) => { calls.push([key,...args]); return chain; };
  } });
  globalThis.__learnwiseTestClient = { from(table) { calls.push(['from',table]); return chain; } };
  const server = await createServer({
    plugins: [{ name: 'injected-client', enforce: 'pre',
      resolveId(source) { if (source.endsWith('supabaseClient')) return '\0injected-client'; },
      load(id) { if (id === '\0injected-client') return 'export const supabase = globalThis.__learnwiseTestClient;'; },
    }],
    configFile: false, ssr: { optimizeDeps: { noDiscovery: true, include: [] } },
    cacheDir: 'node_modules/.vite-service-tests',
    server: { middlewareMode: true, hmr: { server: createHttpServer() } }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const db = await server.ssrLoadModule('/src/services/supabaseData.js');
    await t.test('portal dashboard and lookup failures are visible rather than empty success', async () => {
      for (const action of [db.getAdminDashboardStats, () => db.getTutorDashboardStats('tutor'),
        () => db.getParentDashboardStats('parent'), () => db.getStudentDashboardStats('student'),
        () => db.getStudentsByTutor('tutor'), () => db.getClasses()]) {
        const result = await action();
        assert.equal(result.data,null);
        assert.match(result.error.message,/Service temporarily unavailable/);
      }
    });
    await t.test('public form write fails visibly during an outage', async () => {
      const result = await db.submitAssessmentRequest({parent_name:'Parent',student_name:'Child',parent_email:'p@example.test'});
      assert.match(result.error.message,/Service temporarily unavailable/);
    });
    await t.test('public form inserts only allowed fields without a SELECT', async () => {
      failing = false; calls.length = 0;
      const result = await db.submitAssessmentRequest({parent_name:'Parent',student_name:'Child',parent_email:'p@example.test',status:'Converted',admin_notes:'forged'});
      assert.equal(result.error,null);
      assert.deepEqual(calls,[['from','assessment_requests'],['insert',{parent_name:'Parent',parent_email:'p@example.test',student_name:'Child'}]]);
    });
  } finally { await server.close(); delete globalThis.__learnwiseTestClient; }
});
