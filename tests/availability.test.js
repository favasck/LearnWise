import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResilientFetch, safeServiceAction, SERVICE_UNAVAILABLE } from '../src/services/availability.js';
for (const [name, fetcher] of [
  ['DNS failure', async () => { throw new TypeError('Failed to fetch'); }],
  ['timeout', () => new Promise(() => {})],
  ['server failure', async () => new Response('', { status: 503 })],
]) test(`backend ${name} returns friendly bounded error`, async () => {
  const response = await createResilientFetch(fetcher, 10)('https://example.invalid');
  assert.equal(response.status, 424);
  assert.equal((await response.json()).message, SERVICE_UNAVAILABLE);
});
test('injected failing and stalled client actions settle safely', async () => {
  for (const action of [() => { throw new Error('network'); }, () => new Promise(() => {})]) {
    assert.equal((await safeServiceAction(action, 10)).error.message, SERVICE_UNAVAILABLE);
  }
});
test('successful response body remains readable and validation failures are preserved', async () => {
  const response = await createResilientFetch(async () => new Response('{"message":"Invalid credentials"}', { status: 400 }))('https://example.invalid');
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, 'Invalid credentials');
});

test('successful minimal response does not become an outage error', async () => {
  const response = await createResilientFetch(async () => new Response(null, { status: 204 }))('https://example.invalid');
  assert.equal(response.status, 204);
});
