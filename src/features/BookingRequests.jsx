import React, { useEffect, useState } from 'react';
import { Button, Field, tokens } from '../ui';
import * as db from '../services/supabaseData';
import { activeRequest, bookingTime, nearbyClasses, qatarInput, qatarInstant } from '../services/booking';

const panel={background:'white',border:`1px solid ${tokens.line}`,borderRadius:14,padding:20,marginBottom:18};
const grid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14};
const row={display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'};
const familyRoles=['parent','student'];

function RequestCard({request:r,manager,classes,busy,onRespond}) {
  const [time,setTime]=useState(qatarInput(r.scheduled_at));
  const [note,setNote]=useState('');
  const [proposing,setProposing]=useState(false);
  return <article style={panel}>
    <div style={{...row,justifyContent:'space-between'}}><strong>{r.student?.full_name || 'Student'} · {r.subject}</strong><span className="eyebrow">{r.status}</span></div>
    <p>{bookingTime(r.scheduled_at)} · {r.duration_min} minutes · {r.tutor?.full_name || 'Tutor'}</p>
    <p>{r.mode==='Online'?'Online':r.location} {r.mode==='Offline'&&`· Travel buffer: ${r.buffer_min} min`}</p>
    {r.notes&&<p>Family notes: {r.notes}</p>}
    {r.response_note&&<p>Latest response: {r.response_note}</p>}
    <details><summary>Preferences and activity</summary>
      <p>Preferred times: {r.preferred_times.map(bookingTime).join(' / ')}</p>
      <ol>{[...(r.booking_events||[])].sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(e=><li key={e.id}>{e.status} · {bookingTime(e.scheduled_at)}{e.note&&` · ${e.note}`}</li>)}</ol>
    </details>
    {manager&&activeRequest(r)&&<details style={{marginTop:12}}><summary>Classes and locations on this day</summary>
      {nearbyClasses(classes.filter(c=>c.tutor_id===r.tutor_id),r.scheduled_at).length===0?<p>No classes on this day.</p>:nearbyClasses(classes.filter(c=>c.tutor_id===r.tutor_id),r.scheduled_at).map(c=><p key={c.id}>{bookingTime(c.scheduled_at)} · {c.duration_min} min · {c.student?.full_name} · {c.mode==='Online'?'Online':c.location||'Location not recorded'}</p>)}
      <p>Matching locations can avoid travel gaps. Confirm the actual address before approval.</p>
    </details>}
    {activeRequest(r)&&<div style={{marginTop:16}}>
      <Field label={manager?'Response / reason':'Optional reply'}><textarea maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></Field>
      {manager?<>
        {proposing&&<Field label="Alternative time (Qatar)" required><input type="datetime-local" value={time} onChange={e=>setTime(e.target.value)}/></Field>}
        <div style={row}>
          {r.status==='Pending'&&<Button disabled={busy} onClick={()=>onRespond(r,'confirm',null,note)}>Confirm requested time</Button>}
          <Button variant="secondary" disabled={busy} onClick={()=>setProposing(!proposing)}>{proposing?'Close alternative':'Propose another time'}</Button>
          {proposing&&<Button disabled={busy||!time} onClick={()=>onRespond(r,'propose',qatarInstant(time),note)}>Send alternative</Button>}
          <Button variant="ghost" disabled={busy||!note.trim()} onClick={()=>onRespond(r,'decline',null,note)}>Decline with reason</Button>
        </div>
        {r.status==='Proposed'&&<p>Waiting for the family to accept. This time is not reserved.</p>}
      </>:<div style={row}>
        {r.status==='Proposed'&&<Button disabled={busy} onClick={()=>onRespond(r,'accept',null,note)}>Accept alternative</Button>}
        <Button variant="ghost" disabled={busy} onClick={()=>onRespond(r,'withdraw',null,note)}>Withdraw request</Button>
      </div>}
    </div>}
    {r.status==='Confirmed'&&<p role="status">Added to the class calendar. Future changes are managed from Classes.</p>}
  </article>;
}

export default function BookingRequests({role,service=db}) {
  const manager=!familyRoles.includes(role);
  const [data,setData]=useState({requests:[],availability:[],students:[],tutors:[],classes:[]});
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [filter,setFilter]=useState('Active');
  const [windowForm,setWindowForm]=useState({tutor_id:'',start:'',end:'',mode:'Online',area:'',buffer_min:30});
  const [form,setForm]=useState({student_id:'',tutor_id:'',availability_id:'',times:['','',''],subject:'',duration_min:60,mode:'Online',location:'',notes:''});
  const [slots,setSlots]=useState([]),[slotsLoading,setSlotsLoading]=useState(false),[slotError,setSlotError]=useState('');
  async function load() {
    setLoading(true);setError('');
    const results=await Promise.all([service.getBookingRequests(),service.getTutorAvailability(),service.getStudents(),service.getTutors(),manager?service.getClasses({from:new Date().toISOString()}):Promise.resolve({data:[]})]);
    const failed=results.find(r=>r.error);
    if(failed)setError(failed.error.message);
    else setData(Object.fromEntries(['requests','availability','students','tutors','classes'].map((key,i)=>[key,(results[i].data||[]).filter(r=>!r.deleted_at)])));
    setLoading(false);
  }
  useEffect(()=>{load();},[role]);
  useEffect(()=>{
    let cancelled=false;setSlots([]);setSlotError('');
    if(!form.availability_id||!form.student_id)return;
    setSlotsLoading(true);
    service.getBookingSlots(form.availability_id,form.student_id,Number(form.duration_min),form.location).then(r=>{
      if(cancelled)return;setSlotsLoading(false);if(r.error)setSlotError(r.error.message);else setSlots(r.data||[]);
    });
    return ()=>{cancelled=true;};
  },[form.availability_id,form.student_id,form.duration_min,form.location]);
  const update=(key,value)=>setForm(f=>({...f,[key]:value}));
  async function mutate(fn,success,after) {
    setBusy(true);setError('');setMessage('');
    try {const result=await fn();if(result.error)setError(result.error.message);else{after?.();await load();setMessage(success);}}
    catch {setError('Unable to save. Please retry.');}finally{setBusy(false);}
  }
  const students=data.students.filter(s=>s.status==='Active');
  const student=students.find(s=>s.id===form.student_id);
  const tutorIds=(student?.student_tutors||[]).filter(st=>st.is_active!==false&&!st.deleted_at).map(st=>st.tutor_id||st.tutor?.id);
  const tutors=data.tutors.filter(t=>t.status==='Active'&&(manager||tutorIds.includes(t.id)));
  const windows=data.availability.filter(a=>a.published&&a.tutor_id===form.tutor_id);
  function chooseWindow(id) {
    const a=windows.find(w=>w.id===id);
    setForm(f=>({...f,availability_id:id,times:['','',''],...(a?{mode:a.mode}:{})}));
  }
  if(loading)return <p role="status">Loading booking requests…</p>;
  return <section aria-label="Availability and booking requests">
    <div style={{...row,justifyContent:'space-between'}}><div><h2>{manager?'Availability & booking requests':'Request a class time'}</h2><p>All times are in Qatar (UTC+3). Requests require tutor approval.</p></div><Button variant="ghost" onClick={load} disabled={busy}>Refresh</Button></div>
    {error&&<div role="alert" style={panel}>{error}<p>Refresh to retry. If booking services are not installed yet, contact your administrator.</p></div>}
    {message&&<p role="status">{message}</p>}
    {manager?<>
      <div style={panel}><h3>Share with a family</h3><p>Send this link to a linked parent or student. They sign in to see their assigned tutors.</p><input aria-label="Booking page link" readOnly value={`${window.location.origin}/portal/bookings`}/><Button variant="ghost" onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}/portal/bookings`);setMessage('Booking link copied.');}catch{setMessage('Select and copy the booking link above.');}}}>Copy booking link</Button></div>
      <form style={panel} onSubmit={e=>{e.preventDefault();mutate(()=>service.publishAvailability({tutor_id:windowForm.tutor_id,starts_at:qatarInstant(windowForm.start),ends_at:qatarInstant(windowForm.end),mode:windowForm.mode,area:windowForm.mode==='Offline'?windowForm.area.trim():'',buffer_min:Number(windowForm.buffer_min)}),'Availability published.');}}>
        <h3>Publish available hours</h3><div style={grid}>
          <Field label="Tutor" required><select value={windowForm.tutor_id} onChange={e=>setWindowForm({...windowForm,tutor_id:e.target.value})}><option value="">Choose tutor</option>{tutors.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>
          <Field label="From (Qatar)" required><input type="datetime-local" value={windowForm.start} onChange={e=>setWindowForm({...windowForm,start:e.target.value})}/></Field>
          <Field label="Until (Qatar)" required><input type="datetime-local" value={windowForm.end} min={windowForm.start} onChange={e=>setWindowForm({...windowForm,end:e.target.value})}/></Field>
          <Field label="Session mode"><select value={windowForm.mode} onChange={e=>setWindowForm({...windowForm,mode:e.target.value})}><option>Online</option><option value="Offline">In person</option></select></Field>
          {windowForm.mode==='Offline'&&<Field label="Preferred area" required><input maxLength={120} value={windowForm.area} onChange={e=>setWindowForm({...windowForm,area:e.target.value})}/></Field>}
          <Field label="Travel buffer (minutes)"><input type="number" min="0" max="180" value={windowForm.buffer_min} onChange={e=>setWindowForm({...windowForm,buffer_min:e.target.value})}/></Field>
        </div><Button type="submit" disabled={busy}>Publish availability</Button>
      </form>
      <div style={panel}><h3>Published hours</h3>{data.availability.filter(a=>a.published).length===0&&<p>No published availability yet.</p>}{data.availability.filter(a=>a.published).map(a=><div key={a.id} style={{...row,marginBottom:12}}><span>{a.tutor?.full_name} · {bookingTime(a.starts_at)}–{bookingTime(a.ends_at)} · {a.mode==='Online'?'Online':a.area}</span><Button variant="ghost" disabled={busy} onClick={()=>mutate(()=>service.closeAvailability(a.id),'Availability closed. Existing confirmed classes are unchanged.')}>Close window</Button></div>)}</div>
    </>:<form style={panel} onSubmit={e=>{e.preventDefault();mutate(()=>service.submitBookingRequest({student_id:form.student_id,tutor_id:form.tutor_id,availability_id:form.availability_id||null,preferred_times:form.times.filter(Boolean).map(qatarInstant),subject:form.subject.trim(),duration_min:Number(form.duration_min),mode:form.mode,location:form.mode==='Offline'?form.location.trim():'',notes:form.notes}),'Request sent. Your tutor will confirm or suggest another time.',()=>setForm(f=>({...f,times:['','',''],notes:''})));}}>
      <h3>Your preferred time</h3><div style={grid}>
        <Field label="Student" required><select value={form.student_id} onChange={e=>setForm({...form,student_id:e.target.value,tutor_id:'',availability_id:'',times:['','','']})}><option value="">Choose student</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
        <Field label="Tutor" required><select value={form.tutor_id} onChange={e=>setForm({...form,tutor_id:e.target.value,availability_id:'',times:['','','']})}><option value="">Choose assigned tutor</option>{tutors.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>
        <Field label="Availability window"><select value={form.availability_id} onChange={e=>chooseWindow(e.target.value)}><option value="">Suggest my own time</option>{windows.map(a=><option key={a.id} value={a.id}>{bookingTime(a.starts_at)}–{bookingTime(a.ends_at)} · {a.mode==='Online'?'Online':a.area}</option>)}</select></Field>
        <Field label="Subject" required><input maxLength={120} value={form.subject} onChange={e=>update('subject',e.target.value)}/></Field>
        <Field label="Duration (minutes)" required><input type="number" min="15" max="240" step="15" value={form.duration_min} onChange={e=>update('duration_min',e.target.value)}/></Field>
        <Field label="Session mode"><select disabled={!!form.availability_id} value={form.mode} onChange={e=>update('mode',e.target.value)}><option>Online</option><option value="Offline">In person</option></select></Field>
        {form.mode==='Offline'&&<Field label="Class location / address" required hint="Only you and authorized staff can see this."><input maxLength={500} value={form.location} onChange={e=>update('location',e.target.value)}/></Field>}
      </div>
      {form.availability_id&&<div style={{margin:'12px 0'}}>{slotsLoading?<p role="status">Checking available times…</p>:slotError?<p role="alert">{slotError}</p>:<Field label="Available start times" hint="Times are checked again when confirmed. Choose a time to fill your first preference."><select value="" onChange={e=>{if(e.target.value)setForm(f=>({...f,times:[qatarInput(e.target.value),...f.times.slice(1)]}));}}><option value="">{slots.length?'Choose a start time':'No available times for this duration and location'}</option>{slots.map(s=><option key={s} value={s}>{bookingTime(s)}</option>)}</select></Field>}</div>}
      <div style={grid}>{form.times.map((time,i)=><Field key={i} label={`${i===0?'Preferred time':'Alternative '+i} (Qatar)`} required={i===0}><input type="datetime-local" value={time} onChange={e=>setForm(f=>({...f,times:f.times.map((v,j)=>i===j?e.target.value:v)}))}/></Field>)}</div>
      <Field label="Notes / flexibility"><textarea maxLength={2000} placeholder="For example: any time after 5 pm; 30 minutes either side is fine." value={form.notes} onChange={e=>update('notes',e.target.value)}/></Field>
      <p>This is a one-time request. A time is reserved only after confirmation.</p><Button type="submit" disabled={busy||!form.tutor_id}>Send booking request</Button>
    </form>}
    <div style={row}><h3>{manager?'Request inbox':'Your requests'} ({data.requests.filter(activeRequest).length} awaiting action)</h3><Field label="Show"><select value={filter} onChange={e=>setFilter(e.target.value)}><option>Active</option><option>All</option><option>Confirmed</option><option>Declined</option><option>Withdrawn</option></select></Field></div>
    {data.requests.filter(r=>filter==='All'||(filter==='Active'?activeRequest(r):r.status===filter)).map(r=><RequestCard key={`${r.id}:${r.version}`} request={r} manager={manager} classes={data.classes} busy={busy} onRespond={(request,action,time,note)=>mutate(()=>service.respondBookingRequest(request,action,time,note),action==='propose'?'Alternative sent. Waiting for family acceptance.':action==='confirm'||action==='accept'?'Class confirmed and added to the calendar.':'Request updated.')}/>)}
    {data.requests.filter(r=>filter==='All'||(filter==='Active'?activeRequest(r):r.status===filter)).length===0&&<p>No requests to show.</p>}
  </section>;
}
