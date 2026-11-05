import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStagingReadiness } from '../scripts/staging-readiness.mjs';

const jwt = payload => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.synthetic-signature`;
const settings = {
  approved: true,
  url: 'https://staging.example.test',
  publicKey: jwt({ role: 'anon' }),
  accessToken: jwt({ role: 'authenticated', iss: 'https://staging.example.test/auth/v1', exp: Date.now() / 1000 + 3600 }),
};
const neverFetch = () => { throw new Error('Network must not be used'); };

for (const [name, change] of [
  ['unapproved environment', { approved: false }],
  ['missing URL', { url: '' }],
  ['nonlocal HTTP', { url: 'http://staging.example.test' }],
  ['embedded URL credentials', { url: 'https://user:password@staging.example.test' }],
  ['privileged key', { publicKey: jwt({ role: 'service_role' }) }],
  ['secret key', { publicKey: 'sb_secret_not-allowed' }],
  ['missing session', { accessToken: '' }],
  ['foreign session', { accessToken: jwt({ role: 'authenticated', iss: 'https://other.example.test/auth/v1', exp: Date.now() / 1000 + 3600 }) }],
  ['expired session', { accessToken: jwt({ role: 'authenticated', iss: 'https://staging.example.test/auth/v1', exp: 1 }) }],
]) {
  test(`staging checks block ${name} before network access`, async () => {
    let called = false;
    const result = await checkStagingReadiness({ ...settings, ...change }, () => { called = true; return neverFetch(); });
    assert.equal(called, false);
    assert.equal(result.readyForReadOnlyApiChecks, false);
    assert.equal(result.checks[0].status, 'blocked');
  });
}

test('staging checks only GET metadata and require the new profile RPC', async () => {
  const requests = [];
  const report = await checkStagingReadiness(settings, async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ paths: { '/rpc/admin_update_profile': { post: {} } } }) };
  });
  assert.equal(report.readyForReadOnlyApiChecks, true);
  assert.deepEqual(requests.map(request => [request.options.method, request.url.pathname]), [
    ['GET', '/auth/v1/settings'], ['GET', '/rest/v1/'],
  ]);
  assert.ok(requests.every(request => request.options.redirect === 'error' && !request.options.body));
  assert.equal(JSON.stringify(report).includes(settings.accessToken), false);
  assert.equal(JSON.stringify(report).includes(settings.publicKey), false);
});

test('missing RPC fails readiness without attempting the mutation', async () => {
  const report = await checkStagingReadiness(settings, async () => ({ ok: true, json: async () => ({ paths: {} }) }));
  assert.equal(report.readyForReadOnlyApiChecks, false);
  assert.equal(report.checks.find(check => check.id === 'permission_rpc').status, 'fail');
});

test('rejected session is reported without logging backend response contents', async () => {
  const report = await checkStagingReadiness(settings, async () => ({ ok: false }));
  assert.equal(report.readyForReadOnlyApiChecks, false);
  assert.equal(report.checks.find(check => check.id === 'database_api').status, 'fail');
});

test('network failures cannot leak raw credential-bearing error messages', async () => {
  const report = await checkStagingReadiness(settings, async () => { throw new Error(`sensitive ${settings.accessToken}`); });
  assert.equal(report.readyForReadOnlyApiChecks, false);
  assert.equal(JSON.stringify(report).includes('sensitive'), false);
  assert.equal(JSON.stringify(report).includes(settings.accessToken), false);
});

test('modern publishable keys are accepted without service-role access', async () => {
  const report = await checkStagingReadiness({ ...settings, publicKey: 'sb_publishable_test-only' }, async () => ({ ok: true, json: async () => ({ paths: { '/rpc/admin_update_profile': { post: {} } } }) }));
  assert.equal(report.readyForReadOnlyApiChecks, true);
});
