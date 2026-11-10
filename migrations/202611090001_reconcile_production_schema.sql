-- Reported production gap: date_of_birth only. Notes column/nullability already
-- exist per the owner-supplied 10 November report; do not reassert those claims.
begin;
alter table public.students add column if not exists date_of_birth date;
commit;
notify pgrst,'reload schema';
