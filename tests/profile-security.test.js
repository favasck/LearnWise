import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const ids = {
  admin: '00000000-0000-0000-0000-000000000001',
  student: '00000000-0000-0000-0000-000000000002',
  parent: '00000000-0000-0000-0000-000000000003',
  tutor: '00000000-0000-0000-0000-000000000004',
  suspended: '00000000-0000-0000-0000-000000000005',
};

test('profile permission migration executes and prevents direct privilege escalation', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      -- Baseline is_admin is declared before profiles, so precreate the table.
      create table public.profiles (
        id uuid primary key references auth.users(id), full_name text not null,
        email text not null, role text not null default 'student'
          check (role in ('admin','tutor','parent','student')),
        phone text, status text not null default 'Active'
          check (status in ('Active','Suspended')),
        created_at timestamptz not null default now(), updated_at timestamptz not null default now()
      );
    `);
    const schema = await readFile(new URL('../supabase_setup.sql', import.meta.url), 'utf8');
    // Baseline policies also reference tables declared later in the file.
    // Precreate its exact table definitions in dependency order, then apply all
    // original helpers, triggers and policies unchanged. This is not a clean
    // bootstrap test: the baseline ordering defect is tracked separately.
    for (const ddl of schema.matchAll(/^create table if not exists[\s\S]*?^\);/gm)) {
      await db.exec(ddl[0]);
    }
    // uuid-ossp is unused by schema defaults and unavailable in embedded Postgres.
    await db.exec(schema.replace('create extension if not exists "uuid-ossp";', ''));
    await db.exec(`grant usage on schema public to anon, authenticated;
      grant select, insert, update, delete on all tables in schema public to authenticated;
      grant update (role) on public.profiles to authenticated;
      grant update (status) on public.profiles to public;`);
    for (const [role, id] of Object.entries(ids)) {
      await db.query('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)',
        [id, `${role}@example.test`, { role: ['student','parent','tutor'].includes(role) ? role : 'student' }]);
    }
    await db.query("update public.profiles set role='admin' where id=$1", [ids.admin]);
    await db.query("update public.profiles set status='Suspended' where id=$1", [ids.suspended]);

    async function asUser(id, fn, role = 'authenticated') {
      await db.exec('begin');
      try {
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id || '']);
        await db.exec(`set local role ${role}`);
        return await fn();
      } finally { await db.exec('rollback'); }
    }

    await t.test('baseline exploit reproduced through actual RLS', async () => {
      await asUser(ids.student, async () => {
        await db.query("update public.profiles set role='admin' where id=$1", [ids.student]);
        assert.equal((await db.query('select public.is_admin() as allowed')).rows[0].allowed, true);
      });
    });
    await db.exec(await readFile(new URL('../migrations/202611030001_protect_profile_updates.sql', import.meta.url), 'utf8'));

    for (const role of ['student', 'parent', 'tutor']) {
      for (const elevated of ['admin', 'super_admin', 'admin_tutor']) {
        await t.test(`${role} cannot directly become ${elevated}`, async () => {
          await assert.rejects(asUser(ids[role], () => db.query(
            'update public.profiles set role=$1 where id=$2', [elevated, ids[role]])), { code: '42501' });
        });
      }
      await t.test(`${role} cannot call privileged RPC`, async () => {
        await assert.rejects(asUser(ids[role], () => db.query(
          'select public.admin_update_profile($1,$2)', [ids.admin, { status: 'Suspended' }])), { code: '42501' });
      });
    }
    for (const [column, value] of [['status', 'Active'], ['email', 'changed@example.test'], ['id', ids.tutor]]) {
      await t.test(`self-service cannot change ${column}`, async () => {
        await assert.rejects(asUser(ids.suspended, () => db.query(
          `update public.profiles set ${column}=$1 where id=$2`, [value, ids.suspended])), { code: '42501' });
      });
    }
    await t.test('self-service name and phone edits still work and isolate other users', async () => {
      await asUser(ids.student, async () => {
        const result = await db.query('update public.profiles set full_name=$1,phone=$2 where id=$3 returning full_name,phone',
          ['Updated Name', '123', ids.student]);
        assert.deepEqual(result.rows, [{ full_name: 'Updated Name', phone: '123' }]);
        assert.equal((await db.query("update public.profiles set full_name='forged' where id=$1 returning id", [ids.parent])).rows.length, 0);
      });
    });
    await t.test('authorized admin operation persists audit in the same transaction', async () => {
      await asUser(ids.admin, async () => {
        await db.query('select public.admin_update_profile($1,$2)', [ids.student, { role: 'tutor', status: 'Suspended' }]);
        const events = (await db.query('select * from public.permission_audit_events')).rows;
        assert.equal(events.length, 1);
        assert.equal(events[0].actor_user_id, ids.admin);
        assert.deepEqual(events[0].changes.new, { role: 'tutor', status: 'Suspended' });
        assert.equal(JSON.stringify(events).includes('@example.test'), false);
      });
    });
    for (const [label, actor, target, updates, code] of [
      ['self permission change', ids.admin, ids.admin, { role: 'student' }, '42501'],
      ['protected field injection', ids.admin, ids.student, { email: 'forged' }, '22023'],
      ['invalid role', ids.admin, ids.student, { role: 'super_admin' }, '23514'],
      ['empty update', ids.admin, ids.student, {}, '22023'],
    ]) {
      await t.test(`RPC rejects ${label}`, async () => {
        await assert.rejects(asUser(actor, () => db.query('select public.admin_update_profile($1,$2)', [target, updates])), { code });
      });
    }
    await t.test('suspended admin cannot invoke RPC', async () => {
      await db.query("update public.profiles set status='Suspended' where id=$1", [ids.admin]);
      try {
        await assert.rejects(asUser(ids.admin, () => db.query('select public.admin_update_profile($1,$2)', [ids.student, { role: 'tutor' }])), { code: '42501' });
      } finally { await db.query("update public.profiles set status='Active' where id=$1", [ids.admin]); }
    });
    for (const statement of [
      'insert into public.permission_audit_events default values',
      "update public.permission_audit_events set actor_role='forged'",
      'delete from public.permission_audit_events',
    ]) {
      await t.test(`audit mutation denied: ${statement.split(' ')[0]}`, async () => {
        await assert.rejects(asUser(ids.admin, () => db.exec(statement)), { code: '42501' });
      });
    }
    await t.test('anonymous RPC invocation denied', async () => {
      await assert.rejects(asUser(null, () => db.query('select public.admin_update_profile($1,$2)', [ids.student, { role: 'admin' }]), 'anon'), { code: '42501' });
    });
    await t.test('audit failure rolls back the permission mutation', async () => {
      await db.exec(`create function public.fail_audit() returns trigger language plpgsql as $$
        begin raise exception 'Injected audit failure'; end; $$;
        create trigger fail_audit before insert on public.permission_audit_events
        for each row execute function public.fail_audit();`);
      await assert.rejects(asUser(ids.admin, () => db.query('select public.admin_update_profile($1,$2)', [ids.student, { role: 'tutor' }])), /Injected audit failure/);
      assert.equal((await db.query('select role from public.profiles where id=$1', [ids.student])).rows[0].role, 'student');
    });
  } finally { await db.close(); }
});
