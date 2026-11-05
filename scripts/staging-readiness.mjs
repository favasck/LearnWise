import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function tokenClaims(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); }
  catch { return null; }
}

// GET-only checks: no sign-in, RPC invocation, user-row reads or database writes.
// Never return credentials, response bodies or raw service error messages.
export async function checkStagingReadiness(config, fetchImpl = fetch) {
  const checks = [];
  const record = (id, status, message) => checks.push({ id, status, message });
  const result = () => ({ readyForReadOnlyApiChecks: checks.every(check => check.status === 'pass'), checks });
  if (config.approved !== true) {
    record('staging_approval', 'blocked', 'An explicitly approved nonproduction project is required.');
    return result();
  }
  let endpoint;
  try {
    endpoint = new URL(config.url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
    if ((endpoint.protocol !== 'https:' && !(local && endpoint.protocol === 'http:')) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') throw new Error();
  } catch {
    record('project_configuration', 'blocked', 'Provide a valid HTTPS Supabase project URL (HTTP is allowed only for localhost).');
    return result();
  }
  const keyClaims = tokenClaims(config.publicKey || '');
  const publishable = /^sb_publishable_.+/.test(config.publicKey || '');
  if (!publishable && keyClaims?.role !== 'anon') {
    record('public_key', 'blocked', 'Use a publishable key or legacy anon key; privileged keys are prohibited.');
    return result();
  }
  const sessionClaims = tokenClaims(config.accessToken || '');
  if (!sessionClaims || sessionClaims.role !== 'authenticated' || sessionClaims.iss !== `${endpoint.origin}/auth/v1` || !Number.isFinite(sessionClaims.exp) || sessionClaims.exp <= Date.now() / 1000) {
    record('staging_session', 'blocked', 'A current authenticated test-user session from this staging project is required.');
    return result();
  }
  record('project_configuration', 'pass', 'Approved project configuration and test-session identity are consistent.');
  const headers = { apikey: config.publicKey, Authorization: `Bearer ${config.accessToken}` };
  async function request(path, accept) {
    return fetchImpl(new URL(path, endpoint), {
      method: 'GET', headers: { ...headers, Accept: accept },
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
  }
  try {
    const response = await request('/auth/v1/settings', 'application/json');
    record('auth_api', response.ok ? 'pass' : 'fail', response.ok ? 'Auth settings endpoint is reachable.' : 'Auth settings endpoint rejected the request.');
  } catch { record('auth_api', 'fail', 'Auth settings endpoint could not be reached securely.'); }
  try {
    const response = await request('/rest/v1/', 'application/openapi+json');
    if (!response.ok) {
      record('database_api', 'fail', 'Database API rejected the staging test session.');
      return result();
    }
    const schema = await response.json();
    if (!schema.paths || typeof schema.paths !== 'object') throw new Error();
    record('database_api', 'pass', 'Database API schema is readable by the staging test session.');
    const rpc = schema.paths['/rpc/admin_update_profile']?.post;
    record('permission_rpc', rpc ? 'pass' : 'fail', rpc
      ? 'The required profile-permission RPC is advertised to authenticated users.'
      : 'The required profile-permission RPC is absent or inaccessible; role/status updates are not release-ready.');
  } catch { record('database_api', 'fail', 'Database API schema could not be read securely.'); }
  return result();
}

async function main() {
  let values;
  try { values = parseEnv(await readFile(resolve('.env.staging.local'), 'utf8')); }
  catch {
    console.log(JSON.stringify({ readyForReadOnlyApiChecks: false, checks: [{ id: 'staging_configuration', status: 'blocked', message: 'Create the ignored .env.staging.local from .env.staging.example after selecting an approved nonproduction project.' }] }, null, 2));
    process.exitCode = 2;
    return;
  }
  const report = await checkStagingReadiness({
    approved: values.LEARNWISE_STAGING_APPROVED === 'true',
    url: values.VITE_SUPABASE_URL,
    publicKey: values.VITE_SUPABASE_ANON_KEY,
    accessToken: values.LEARNWISE_STAGING_ACCESS_TOKEN,
  });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.readyForReadOnlyApiChecks ? 0 : 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
