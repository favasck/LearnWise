import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthSession } from '../src/features/auth/authSession.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const session = id => ({ user: { id } });

test('missing backend opens the public session and allows safe cleanup and refresh', async () => {
  const states = [];
  const controller = createAuthSession(null, state => states.push(state));
  controller.start();
  assert.deepEqual(states.at(-1), { user: null, profile: null, loading: false, authError: null });
  assert.equal(await controller.refresh(), null);
  controller.stop();
});

function fixture() {
  const initial = deferred();
  const requests = [];
  const tasks = [];
  const states = [];
  let notify, unsubscribed = false;
  const client = {
    auth: {
      getSession: () => initial.promise,
      onAuthStateChange(callback) {
        notify = callback;
        return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
      },
    },
    from(table) {
      assert.equal(table, 'profiles');
      return { select() { return { eq(column, id) {
        assert.equal(column, 'id');
        return { maybeSingle() {
          const result = deferred();
          requests.push({ id, ...result });
          return result.promise;
        } };
      } }; } };
    },
  };
  const controller = createAuthSession(client, state => states.push(state), task => tasks.push(task));
  controller.start();
  return {
    initial, requests, states, controller, client,
    emit: value => notify('SIGNED_IN', value),
    flush() { while (tasks.length) tasks.shift()(); },
    latest: () => states.at(-1),
    unsubscribed: () => unsubscribed,
  };
}

test('auth callback returns synchronously and queries only after deferred execution', async () => {
  const f = fixture();
  assert.equal(f.emit(session('a')), undefined);
  assert.equal(f.requests.length, 0);
  assert.equal(f.latest().profile, null);
  f.flush();
  f.requests[0].resolve({ data: { id: 'a', role: 'student' }, error: null });
  await tick();
  assert.equal(f.latest().profile.role, 'student');
  assert.equal(f.latest().loading, false);
  f.controller.stop();
});

test('logout invalidates an in-flight privileged profile response', async () => {
  const f = fixture();
  f.emit(session('a')); f.flush();
  f.emit(null);
  f.requests[0].resolve({ data: { id: 'a', role: 'super_admin' } });
  await tick();
  assert.deepEqual(f.latest(), { user: null, profile: null, loading: false, authError: null });
});

test('account switch rejects old profile and does not retain old permissions', async () => {
  const f = fixture();
  f.emit(session('a')); f.flush();
  f.emit(session('b')); f.flush();
  assert.equal(f.latest().user.id, 'b');
  assert.equal(f.latest().profile, null);
  f.requests[1].resolve({ data: { id: 'b', role: 'student' } });
  f.requests[0].resolve({ data: { id: 'a', role: 'admin' } });
  await tick();
  assert.equal(f.latest().profile.id, 'b');
  assert.equal(f.latest().profile.role, 'student');
});

test('auth event wins over stale initial getSession result', async () => {
  const f = fixture();
  f.emit(session('b')); f.flush();
  f.initial.resolve({ data: { session: session('a') } });
  await tick(); f.flush();
  assert.deepEqual(f.requests.map(r => r.id), ['b']);
  assert.equal(f.latest().user.id, 'b');
});

test('initial session restores profile without an auth event', async () => {
  const f = fixture();
  f.initial.resolve({ data: { session: session('a') } });
  await tick(); f.flush();
  f.requests[0].resolve({ data: { id: 'a', role: 'parent' } });
  await tick();
  assert.equal(f.latest().profile.role, 'parent');
});

test('unauthenticated initial session exits loading', async () => {
  const f = fixture();
  f.initial.resolve({ data: { session: null } });
  await tick();
  assert.equal(f.latest().loading, false);
  assert.equal(f.latest().user, null);
});

for (const failure of ['error', 'missing', 'wrong identity', 'rejection']) {
  test(`profile ${failure} fails closed without browser profile creation`, async () => {
    const f = fixture();
    f.emit(session('a')); f.flush();
    if (failure === 'rejection') f.requests[0].reject(new Error('network details'));
    else f.requests[0].resolve({
      data: failure === 'wrong identity' ? { id: 'other', role: 'admin' } : null,
      error: failure === 'error' ? { message: 'internal details' } : null,
    });
    await tick();
    assert.equal(f.latest().profile, null);
    assert.equal(f.latest().loading, false);
    assert.ok(f.latest().authError);
    assert.equal(f.latest().authError.includes('details'), false);
  });
}

test('refresh invalidates older results and loads changed suspension state', async () => {
  const f = fixture();
  f.emit(session('a')); f.flush();
  const refresh = f.controller.refresh();
  f.requests[1].resolve({ data: { id: 'a', role: 'student', status: 'Suspended' } });
  await refresh;
  f.requests[0].resolve({ data: { id: 'a', role: 'admin', status: 'Active' } });
  await tick();
  assert.equal(f.latest().profile.status, 'Suspended');
});

test('clear immediately removes permissions and invalidates queued requests', async () => {
  const f = fixture();
  f.emit(session('a'));
  f.controller.clear(); f.flush();
  assert.equal(f.requests.length, 0);
  assert.equal(f.latest().user, null);
  f.initial.resolve({ data: { session: null } });
  assert.equal(await f.controller.refresh(), undefined);
});

test('stop unsubscribes and ignores in-flight queries and auth events', async () => {
  const f = fixture();
  f.emit(session('a')); f.flush();
  const count = f.states.length;
  f.controller.stop();
  f.requests[0].resolve({ data: { id: 'a', role: 'admin' } });
  f.emit(session('b'));
  f.initial.resolve({ data: { session: session('b') } });
  await tick();
  assert.equal(f.unsubscribed(), true);
  assert.equal(f.states.length, count);
});

test('session initialization failure can be retried', async () => {
  const f = fixture();
  f.initial.reject(new Error('network unavailable'));
  await tick();
  assert.ok(f.latest().authError);
  assert.equal(f.latest().loading, false);
  f.client.auth.getSession = async () => ({ data: { session: session('a') } });
  await f.controller.refresh(); f.flush();
  f.requests[0].resolve({ data: { id: 'a', role: 'tutor' } });
  await tick();
  assert.equal(f.latest().authError, null);
  assert.equal(f.latest().profile.role, 'tutor');
});

test('stalled injected session client stops loading with a friendly retry error', async () => {
  const states = [];
  const client = { auth: {
    getSession: () => new Promise(() => {}),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } };
  const controller = createAuthSession(client, value => states.push(value), fn => fn(), 10);
  controller.start();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(states.at(-1).loading, false);
  assert.match(states.at(-1).authError, /Service temporarily unavailable/);
  assert.equal(states.at(-1).profile, null);
  controller.stop();
});
