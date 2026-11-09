import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const sql = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

test('reconcile migration upgrades the older production shape without losing data', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;`);
    await db.exec(await sql('migrations/202611070001_bootstrap_schema.sql'));

    // Recreate what the live database reports: these two columns are absent.
    await db.exec(`alter table public.class_notes drop column areas_to_improve;
      alter table public.students drop column date_of_birth;
      alter table public.class_notes alter column class_id set not null;`);

    await db.query('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)', [id(1), '1@example.test', { role: 'tutor' }]);
    await db.query("insert into public.tutors(id,user_id,full_name) values ($1,$1,'Tutor')", [id(1)]);
    await db.query("insert into public.students(id,full_name) values ($1,'Student')", [id(2)]);
    await db.query('insert into public.student_tutors(student_id,tutor_id) values ($1,$2)', [id(2), id(1)]);
    await db.query("insert into public.classes(id,student_id,tutor_id,subject,scheduled_at) values ($1,$2,$3,'Math',now())", [id(3), id(2), id(1)]);
    await db.query("insert into public.class_notes(id,class_id,tutor_id,student_id,topic) values ($1,$2,$3,$4,'Existing')", [id(4), id(3), id(1), id(2)]);

    const migration = await sql('migrations/202611090001_reconcile_production_schema.sql');
    await db.exec(migration);
    await db.exec(migration);

    await t.test('existing records survive', async () => {
      const { rows } = await db.query('select topic, class_id from public.class_notes where id=$1', [id(4)]);
      assert.deepEqual(rows, [{ topic: 'Existing', class_id: id(3) }]);
    });

    await t.test('the class note from the failing form saves, with and without a class', async () => {
      for (const classId of [id(3), null]) {
        await db.query(
          "insert into public.class_notes(class_id,tutor_id,student_id,topic,areas_to_improve) values ($1,$2,$3,'Note','concepts')",
          [classId, id(1), id(2)]);
      }
      const { rows } = await db.query("select count(*)::int as n from public.class_notes where areas_to_improve='concepts'");
      assert.equal(rows[0].n, 2);
    });

    await t.test('hardening migration still applies to the upgraded database', async () => {
      await db.exec(await sql('migrations/202611030001_protect_profile_updates.sql'));
      await db.exec(migration);
      const { rows } = await db.query("select to_regclass('public.permission_audit_events') is not null as found");
      assert.equal(rows[0].found, true);
    });

    await t.test('schema report runs and reports the expected shape', async () => {
      const { rows } = await db.query((await sql('scripts/production-schema-report.sql')).replace(/;\s*$/, ''));
      assert.ok(rows.some(r => r.section === 'profile_roles'));
      assert.ok(rows.some(r => r.section === 'column_not_null' && r.detail === 'YES'));
      assert.ok(rows.some(r => r.section === 'function' && r.item === 'admin_update_profile'));
    });
  } finally { await db.close(); }
});
