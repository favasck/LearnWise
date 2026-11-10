// RECONSTRUCTION, NOT A PRODUCTION EXPORT. Constraint/role counts and policy
// behavior follow the owner's 10 Nov note. Unknown predicates and the old RPC
// body are synthetic. Never describe a pass here as production verification.
import {readFile}from'node:fs/promises';
export const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
export const migration=name=>readFile(new URL('../../migrations/'+name,import.meta.url),'utf8');
export async function reportedFixture(db){
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz);
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid(),auth.jwt() to anon,authenticated;`);
 await db.exec(await migration('202611070001_bootstrap_schema.sql'));
 await db.exec(`alter table students drop column date_of_birth;
 drop policy profile_edit on profiles;drop policy profile_read on profiles;
 create policy "profiles: own read" on profiles for select to authenticated using(id=auth.uid());
 create policy "profiles: staff read" on profiles for select to authenticated using(public.is_admin());
 create function public.fixture_profile_unchanged(target uuid,new_role text,new_status text)returns boolean
 language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles p where p.id=target and p.role=new_role and p.status=new_status)$$;
 create policy "profiles: own update safe fields" on profiles for update to authenticated
 using(id=auth.uid()) with check(id=auth.uid() and public.fixture_profile_unchanged(id,role,status));
 create policy "profiles: admin all" on profiles for all to authenticated
 using(auth.jwt()->'user_metadata'->>'role'='admin' or auth.jwt()->'app_metadata'->>'role'='admin')
 with check(auth.jwt()->'user_metadata'->>'role'='admin' or auth.jwt()->'app_metadata'->>'role'='admin');
 create policy "profiles: admin_tutor update safe fields" on profiles for update to authenticated
 using(exists(select 1 from profiles profiles_1 where profiles_1.id=profiles_1.id and profiles_1.role='admin_tutor'));
 grant update on profiles to authenticated;
 -- Synthetic overload: only argument count/default EXECUTE are reported.
 -- These argument types/body are NOT claimed to be the live definition.
 create function public.record_payment(p_invoice_id uuid,p_parent_id uuid,p_student_id uuid,p_tutor_id uuid,p_amount numeric,p_method text,p_reference text,p_notes text,p_actor_user_id uuid,p_actor_role text)
 returns text language sql security definer as $$select 'synthetic legacy payment'::text$$;`);
 for(const[n,role]of [[1,'super_admin'],[2,'tutor'],[3,'parent'],[4,'student'],[5,'student'],[6,'tutor'],[7,'super_admin'],[8,'admin_tutor']]){
  await db.query('insert into auth.users(id,email,raw_user_meta_data)values($1,$2,$3)',[id(n),n+'@example.test',{role:['tutor','parent','student'].includes(role)?role:'student'}]);
  await db.query('update profiles set role=$1 where id=$2',[role,id(n)]);
 }
 for(const n of[3,9,10])await db.query("insert into parents(id,user_id,full_name)values($1,$2,'Parent')",[id(n),n===3?id(3):null]);
 for(const n of[2,6,11,12])await db.query("insert into tutors(id,user_id,full_name)values($1,$2,'Tutor')",[id(n),[2,6].includes(n)?id(n):null]);
 for(const n of[4,5,13])await db.query("insert into students(id,user_id,parent_id,full_name)values($1,$2,$3,'Student')",[id(n),[4,5].includes(n)?id(n):null,id(3)]);
 await db.query('insert into student_tutors(student_id,tutor_id)values($1,$2)',[id(4),id(2)]);
 for(const n of[20,21])await db.query("insert into classes(id,student_id,tutor_id,subject,scheduled_at)values($1,$2,$3,'Math',now())",[id(n),id(4),id(2)]);
 for(const n of[22,23]){
  await db.query("insert into invoices(id,parent_id,student_id,invoice_number,total_qar,paid_qar,status)values($1,$2,$3,$4,10,5,'Partially Paid')",[id(n),id(3),id(4),'FIXTURE-'+n]);
  await db.query("insert into payments(id,invoice_id,parent_id,student_id,amount_qar,method)values($1,$2,$3,$4,5,'Cash')",[id(n+2),id(n),id(3),id(4)]);
 }
}
export async function asUser(db,n,fn,{role='authenticated',commit=false,claims={}}={}){
 await db.exec('begin');try{
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[n?id(n):'',JSON.stringify(claims)]);
  await db.exec(`set local role ${role}`);const r=await fn();await db.exec(commit?'commit':'rollback');return r;
 }catch(e){await db.exec('rollback');throw e;}
}
