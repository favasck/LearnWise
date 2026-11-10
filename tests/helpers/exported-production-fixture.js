import{readFile}from'node:fs/promises';
import{reportedFixture}from'./reported-production-fixture.js';
export async function exportedFixture(db){
 await reportedFixture(db);
 // Already applied by Fawaz on 10 November; baseline must include this column.
 await db.exec('alter table public.students add column if not exists date_of_birth date');
 const text=await readFile(new URL('../fixtures/production-export-20261110.md',import.meta.url),'utf8');
 const policies=text.split(/\r?\n/).filter(line=>/^[a-z_]+ \| /.test(line)).map(line=>{
  const[table,name,cmd,roles,using,check]=line.split(' | ');
  return{table,name,cmd,roles,using:using.slice(7),check:check.slice(7)};
 });
 await db.exec(`do $$ declare p record;begin for p in select tablename,policyname from pg_policies where schemaname='public'loop execute format('drop policy %I on public.%I',p.policyname,p.tablename);end loop;end$$;`);
 for(const name of['is_staff','is_super_admin','is_admin_tutor'])await db.exec(`create function public.${name}()returns boolean language sql security definer as $$select false$$`);
 for(const p of policies){
  const quote=s=>'"'+s.replaceAll('"','""')+'"';
  await db.exec(`create policy ${quote(p.name)} on public.${quote(p.table)} as permissive for ${p.cmd} to ${p.roles}${p.using==='-'?'':` using(${p.using})`}${p.check==='-'?'':` with check(${p.check})`}`.replace(/\bis_(admin|super_admin|admin_tutor|staff)\(\)/g,'public.is_$1()'));
 }
 // Exact SQL expressions supplied for these helpers; intentionally no status
 // check here, because the live export has none. Candidate tests must repair it.
 for(const[name,expression]of Object.entries({is_admin:"role in ('super_admin','admin_tutor')",is_staff:"role in ('super_admin','admin_tutor')",is_super_admin:"role='super_admin'",is_admin_tutor:"role='admin_tutor'"})){
  await db.exec(`create or replace function public.${name}()returns boolean language sql stable security definer set search_path=public as $$select coalesce((select ${expression} from public.profiles where id=auth.uid()),false)$$;grant execute on function public.${name}()to anon,authenticated;`);
 }
 for(const name of['can_manage_academic','can_manage_payments'])await db.exec(`create or replace function public.${name}()returns boolean language sql stable security definer set search_path=public as $$select public.is_staff()$$;grant execute on function public.${name}()to anon,authenticated;`);
 await db.exec(`create or replace function public.get_my_role()returns text language sql stable security definer set search_path=public as $$select role from public.profiles where id=auth.uid()$$;
 grant execute on function public.get_my_role()to anon,authenticated;
 alter table payments add column status text not null default 'Recorded';
 -- Table grants/DDL were not included in the supplied export. These deliberately
 -- broad fixture grants expose policy weaknesses rather than hiding them.
 grant select,insert,update,delete on all tables in schema public to anon,authenticated;`);
 await db.exec(`create or replace function public.handle_new_user()returns trigger language plpgsql security definer set search_path=public as $$
 declare r text:=case when new.raw_user_meta_data->>'role'in('tutor','parent','student')then new.raw_user_meta_data->>'role'else 'student'end;n text:=coalesce(new.raw_user_meta_data->>'full_name',new.email);begin
 insert into public.profiles(id,full_name,email,role)values(new.id,n,new.email,r)on conflict(id)do nothing;
 if r='tutor'then insert into public.tutors(user_id,full_name,email,status)values(new.id,n,new.email,'Active');elsif r='parent'then insert into public.parents(user_id,full_name,email,status)values(new.id,n,new.email,'Active');else insert into public.students(user_id,full_name,email,status)values(new.id,n,new.email,'Active');end if;return new;end$$;`);
 await db.exec(`drop function public.record_payment(uuid,uuid,uuid,uuid,numeric,text,text,text,uuid,text);
 create function public.record_payment(p_invoice_id uuid,p_parent_id uuid,p_student_id uuid,p_tutor_id uuid,p_amount_qar numeric,p_method text,p_reference text,p_notes text,p_actor_user_id uuid,p_actor_role text)returns jsonb language plpgsql security definer set search_path=public as $$
 declare inv public.invoices;payment uuid;paid numeric;new_status text;begin
 if not public.is_staff()then return jsonb_build_object('success',false,'error','Unauthorized');end if;
 select * into inv from public.invoices where id=p_invoice_id for update;if inv.id is null or inv.status='Voided'then return jsonb_build_object('success',false,'error','Invoice unavailable');end if;
 insert into public.payments(invoice_id,parent_id,student_id,tutor_id,amount_qar,method,reference,notes,status,paid_at)values(p_invoice_id,p_parent_id,p_student_id,p_tutor_id,p_amount_qar,p_method,p_reference,p_notes,'Recorded',now())returning id into payment;
 select sum(amount_qar)into paid from public.payments where invoice_id=p_invoice_id and status='Recorded';new_status:=case when paid>=inv.total_qar then 'Paid'when paid>0 then 'Partially Paid'else inv.status end;
 update public.invoices set paid_qar=paid,status=new_status,updated_at=now()where id=p_invoice_id;
 insert into public.audit_logs(actor_user_id,actor_role,action,table_name,record_id)values(p_actor_user_id,p_actor_role,'record_payment','payments',payment);
 return jsonb_build_object('success',true,'payment_id',payment,'new_paid',paid,'new_status',new_status);end$$;
 grant execute on function public.record_payment(uuid,uuid,uuid,uuid,numeric,text,text,text,uuid,text)to anon,authenticated;`);
 // The source summarized these two bodies rather than exporting full DDL.
 // Preserve that limitation instead of describing them as byte-for-byte copies.
 return{policies,summaryOnly:['handle_new_user','record_payment'],tableGrants:'permissive test scaffolding; not exported'};
}
