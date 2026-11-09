-- Brings a database created from the older schema up to what the app writes.
-- Additive and safe to re-run: no data is changed or removed.
-- Run after 202611030001_protect_profile_updates.sql, so the final line also
-- makes the API notice objects created by that migration.
begin;

-- Class notes form: "Could not find the 'areas_to_improve' column".
alter table public.class_notes add column if not exists areas_to_improve text;

-- Column defined by the bootstrap schema but absent from production.
alter table public.students add column if not exists date_of_birth date;

-- The form labels Linked Class as optional and the access rules accept no class.
alter table public.class_notes alter column class_id drop not null;

commit;

notify pgrst, 'reload schema';
