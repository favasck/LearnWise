import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeSupabase } from '../src/config/supabase.js';

for (const [label, url, key] of [
  ['missing URL', undefined, 'public-test-key'],
  ['missing key', 'https://example.supabase.co', undefined],
  ['invalid URL', 'invalid', 'public-test-key'],
  ['invalid protocol', 'file:///example', 'public-test-key'],
]) {
  test(`Supabase initialization handles ${label} without creating a client`, () => {
    const result = initializeSupabase(() => { throw new Error('Must not construct'); }, url, key);
    assert.deepEqual(result, { client: null, configured: false });
  });
}

test('valid configuration constructs the real client', () => {
  const client = {};
  const result = initializeSupabase((url, key) => {
    assert.equal(url, 'https://example.supabase.co');
    assert.equal(key, 'public-test-key');
    return client;
  }, 'https://example.supabase.co', 'public-test-key');
  assert.deepEqual(result, { client, configured: true });
});

test('SDK construction failure becomes an unavailable state without leaking details', () => {
  assert.deepEqual(initializeSupabase(() => { throw new Error('private failure detail'); },
    'https://example.supabase.co', 'public-test-key'), { client: null, configured: false });
});
