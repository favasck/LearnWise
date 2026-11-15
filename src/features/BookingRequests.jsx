import React, { useEffect, useState } from 'react';
import { Button, Field, tokens } from '../ui';
import * as db from '../services/supabaseData';
import { activeRequest, bookingCalendarItems, bookingTime, defaultRecurrence, qatarInput, qatarInstant, recurrenceTimes } from '../services/booking';
import { bookingGrid as grid, DurationField, RecurrenceFields } from './BookingFields';
import BookingReviewCard from './BookingReviewCard';
import BookingExams from './BookingExams';
import SessionCalendar from './SessionCalendar';
import { dailyAvailability } from '../services/dailyAvailability.js';

const panel={background:'white',border:`1px solid ${tokens.line}`,borderRadius:14,padding:20,marginBottom:18};
const row={display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'};
const familyRoles=['parent','student'];
const newForm=()=>({student_id:'',student_name:'',student_details:'',tutor_id:'',availability_id:'',times:['','',''],subject:'',duration_min:60,mode:'Online',location:'',notes:'',recurrence:defaultRecurrence()});
const modeLabel=mode=>mode==='Either'?'Online or in person':mode==='Offline'?'In person':'Online';

export default function BookingRequests({role,service=db}) {
  const manager=!familyRoles.includes(role);
  const [data,setData]=useState({requests:[],availability:[],students:[],tutors:[],classes:[],exams:[]});
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [filter,setFilter]=useState('Active');
  const [windowForm,setWindowForm]=useState({tutor_id:'',date_from:'',date_to:'',time_from:'09:00',time_to:'16:00',exclude_fridays:false,mode:'Either',buffer_min:30});
  const [form,setForm]=useState(newForm);
  const [slots,setSlots]=useState([]),[slotsLoading,setSlotsLoading]=useState(false),[slotError,setSlotError]=useState('');
  async function load() {
    setLoading(true);setError('');
    try {
      const results=await Promise.all([service.getBookingRequests(),service.getTutorAvailability(),service.getStudents(),service.getTutors(),service.getClasses(),service.getStudentExams()]);
      const failed=results.find(r=>r.error);
      if(failed){setError(failed.error.message);return false;}
      setData(Object.fromEntries(['requests','availability','students','tutors','classes','exams'].map((key,i)=>[key,(results[i].data||[]).filter(r=>!r.deleted_at)])));
      return true;
    }catch{setError('Unable to load booking services. Please refresh to retry.');return false;}
    finally{setLoading(false);}
  }
  useEffect(()=>{let active=true;load().catch(()=>{if(active){setError('Unable to load booking services. Please refresh to retry.');setLoading(false);}});return()=>{active=false;};},[role]);
  useEffect(()=>{
    let cancelled=false;setSlots([]);setSlotError('');setSlotsLoading(false);
    if(!form.availability_id||!form.student_id)return;
    setSlotsLoading(true);
    service.getBookingSlotsV2(form.availability_id,form.student_id,Number(form.duration_min),form.location,form.mode).then(r=>{
      if(cancelled)return;setSlotsLoading(false);if(r.error)setSlotError(r.error.message);else setSlots(r.data||[]);
    }).catch(()=>{if(!cancelled){setSlotsLoading(false);setSlotError('Unable to check slots. Please refresh.');}});
    return ()=>{cancelled=true;};
  },[form.availability_id,form.student_id,form.duration_min,form.location,form.mode]);
  const update=(key,value)=>setForm(f=>({...f,[key]:value}));
  async function mutate(fn,success,after) {
    setBusy(true);setError('');setMessage('');
    try {const result=await fn();if(result.error)setError(result.error.message);else{after?.();const refreshed=await load();setMessage(refreshed?success:'Saved. Refresh to load the latest calendar.');}}
    catch {setError('Unable to save. Please retry.');}finally{setBusy(false);}
  }
  const students=data.students.filter(s=>s.status==='Active');
  const student=students.find(s=>s.id===form.student_id);
  const tutorIds=(student?.student_tutors||[]).filter(st=>st.is_active!==false&&!st.deleted_at).map(st=>st.tutor_id||st.tutor?.id);
  const tutors=data.tutors.filter(t=>t.status==='Active'&&(manager||tutorIds.includes(t.id)));
  const windows=data.availability.filter(a=>a.published&&a.tutor_id===form.tutor_id);
  const selectedWindow=windows.find(a=>a.id===form.availability_id);
  function chooseWindow(id) {
    const a=windows.find(w=>w.id===id);
    setForm(f=>({...f,availability_id:id,times:['','',''],...(a&&a.mode!=='Either'?{mode:a.mode}:{})}));
  }
  let previewError='',preview=[];
  try{if(form.times[0])preview=recurrenceTimes(qatarInstant(form.times[0]),form.recurrence);}catch(e){previewError=e.message;}
  const visible=data.requests.filter(r=>filter==='All'||(filter==='Active'?activeRequest(r):r.status===filter));
  const reviewRequest=id=>{setFilter('All');setTimeout(()=>{const element=document.getElementById(`booking-${id}`);element?.scrollIntoView?.({behavior:'smooth',block:'start'});element?.focus();},0);};
  if(loading)return <p role="status">Loading booking requests…</p>;
  return <section aria-label="Availability and booking requests">
    <div style={{...row,justifyContent:'space-between'}}><div><h2>{manager?'Availability & booking requests':'Book a class'}</h2><p>All times are in Qatar (UTC+3). The tutor reviews every date before confirming.</p></div><Button variant="ghost" onClick={()=>load().catch(()=>setError('Unable to refresh. Please retry.'))} disabled={busy}>Refresh</Button></div>
    {error&&<div role="alert" style={panel}>{error}<p>Refresh to retry or contact your administrator.</p></div>}
    {message&&<p role="status">{message}</p>}
    {manager?<>
      <div style={panel}><h3>Share with a family</h3><p>Send this link to a linked parent or student. They sign in to book with their assigned tutors.</p><input aria-label="Booking page link" readOnly value={`${window.location.origin}/portal/bookings`}/><Button variant="ghost" onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}/portal/bookings`);setMessage('Booking link copied.');}catch{setMessage('Select and copy the booking link above.');}}}>Copy booking link</Button></div>
      <form style={panel} onSubmit={e=>{e.preventDefault();let windows;try{windows=dailyAvailability(windowForm);}catch(error){setError(error.message);return;}mutate(()=>service.publishAvailability(windows),`${windows.length} daily availability windows published.`);}}>
        <h3>Publish available dates and slots</h3><p>Daily hours apply on each date in the range. Time outside these hours is unavailable. Add another range for different hours.</p><div style={grid}>
          <Field label="Tutor" required><select value={windowForm.tutor_id} onChange={e=>setWindowForm({...windowForm,tutor_id:e.target.value})}><option value="">Choose tutor</option>{tutors.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>
          <Field label="From date (Qatar)" required><input type="date" required value={windowForm.date_from} onChange={e=>setWindowForm({...windowForm,date_from:e.target.value})}/></Field>
          <Field label="To date (inclusive)" required><input type="date" required value={windowForm.date_to} min={windowForm.date_from} onChange={e=>setWindowForm({...windowForm,date_to:e.target.value})}/></Field>
          <Field label="Daily start time (Qatar)" required><input type="time" required value={windowForm.time_from} onChange={e=>setWindowForm({...windowForm,time_from:e.target.value})}/></Field>
          <Field label="Daily end time (Qatar)" required><input type="time" required value={windowForm.time_to} onChange={e=>setWindowForm({...windowForm,time_to:e.target.value})}/></Field>
          <label><input type="checkbox" checked={windowForm.exclude_fridays} onChange={e=>setWindowForm({...windowForm,exclude_fridays:e.target.checked})}/> Exclude Fridays</label>
          <Field label="Available class modes"><select value={windowForm.mode} onChange={e=>setWindowForm({...windowForm,mode:e.target.value})}><option value="Either">Online or in person</option><option value="Online">Online</option><option value="Offline">In person</option></select></Field>
          <Field label="Travel buffer (minutes)"><input type="number" min="0" max="180" value={windowForm.buffer_min} onChange={e=>setWindowForm({...windowForm,buffer_min:e.target.value})}/></Field>
        </div><Button type="submit" disabled={busy}>Publish availability</Button>
      </form>
      <div style={panel}><h3>Available dates and slots</h3>{data.availability.filter(a=>a.published).length===0&&<p>No availability published yet.</p>}{data.availability.filter(a=>a.published).map(a=><div key={a.id} style={{...row,marginBottom:12}}><span>{a.tutor?.full_name} · {bookingTime(a.starts_at)}–{bookingTime(a.ends_at)} · {modeLabel(a.mode)}</span><Button variant="ghost" disabled={busy} onClick={()=>mutate(()=>service.closeAvailability(a.id),'Availability closed. Confirmed classes are unchanged.')}>Close window</Button></div>)}</div>
    </>:<form style={panel} onSubmit={e=>{e.preventDefault();if(previewError||!preview.length){setError(previewError||'Choose the first session date and time.');return;}
      mutate(()=>service.submitBookingRequest({student_id:form.student_id,student_name:form.student_name.trim(),student_details:form.student_details,tutor_id:form.tutor_id,availability_id:form.availability_id||null,preferred_times:form.times.filter(Boolean).map(qatarInstant),subject:form.subject.trim(),duration_min:Number(form.duration_min),mode:form.mode,location:form.mode==='Offline'?form.location.trim():'',notes:form.notes,recurrence:form.recurrence}),'Request sent. The tutor will review the full schedule.',()=>setForm(f=>({...f,times:['','',''],notes:''})));}}>
      <h3>Student and session details</h3><div style={grid}>
        <Field label="Student record" required hint="Choose your linked child, then check the name and details below."><select value={form.student_id} onChange={e=>{const s=students.find(s=>s.id===e.target.value);setForm({...newForm(),student_id:e.target.value,student_name:s?.full_name||'',student_details:[s?.grade,s?.school,s?.curriculum].filter(Boolean).join(' · ')});}}><option value="">Choose student</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
        <Field label="Student name" required><input maxLength={160} value={form.student_name} onChange={e=>update('student_name',e.target.value)}/></Field>
        <Field label="Tutor" required><select value={form.tutor_id} onChange={e=>setForm({...form,tutor_id:e.target.value,availability_id:'',times:['','','']})}><option value="">Choose assigned tutor</option>{tutors.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>
        <Field label="Subject" required><input maxLength={120} value={form.subject} onChange={e=>update('subject',e.target.value)}/></Field>
      </div><Field label="Student details" hint="For example: year group, school, exam board, learning needs or lesson goals."><textarea maxLength={2000} value={form.student_details} onChange={e=>update('student_details',e.target.value)}/></Field>
      <div style={grid}>
        <DurationField value={form.duration_min} onChange={v=>update('duration_min',v)}/>
        <Field label="Class mode"><select value={form.mode} disabled={!!selectedWindow&&selectedWindow.mode!=='Either'} onChange={e=>update('mode',e.target.value)}><option value="Online">Online</option><option value="Offline">In person</option></select></Field>
        {form.mode==='Offline'&&<Field label="Student location / address" required hint="Visible only to you and authorized staff."><input maxLength={500} value={form.location} onChange={e=>update('location',e.target.value)}/></Field>}
        <Field label="Available date / slot"><select value={form.availability_id} onChange={e=>chooseWindow(e.target.value)}><option value="">Suggest my own date and time</option>{windows.map(a=><option key={a.id} value={a.id}>{bookingTime(a.starts_at)}–{bookingTime(a.ends_at)} · {modeLabel(a.mode)}</option>)}</select></Field>
      </div>
      {form.availability_id&&<div style={{margin:'12px 0'}}>{slotsLoading?<p role="status">Checking available times…</p>:slotError?<p role="alert">{slotError}</p>:<Field label="Available start times" hint="This slot applies to the first session. The tutor reviews all repeating dates."><select value="" onChange={e=>{if(e.target.value)setForm(f=>({...f,times:[qatarInput(e.target.value),...f.times.slice(1)]}));}}><option value="">{slots.length?'Choose a start time':'No slots available for these details'}</option>{slots.map(s=><option key={s} value={s}>{bookingTime(s)}</option>)}</select></Field>}</div>}
      <div style={grid}>{form.times.map((time,i)=><Field key={i} label={`${i===0?'First session':'Alternative first session '+i} (Qatar)`} required={i===0}><input type="datetime-local" value={time} onChange={e=>setForm(f=>({...f,times:f.times.map((v,j)=>i===j?e.target.value:v)}))}/></Field>)}</div>
      <RecurrenceFields value={form.recurrence} onChange={v=>update('recurrence',v)} firstTime={form.times[0]}/>
      <Field label="Notes / flexibility"><textarea maxLength={2000} placeholder="Mention flexible times or other details for the tutor." value={form.notes} onChange={e=>update('notes',e.target.value)}/></Field>
      <p>Pending dates appear in the calendar. Sessions are reserved only after confirmation.</p><Button type="submit" disabled={busy||!form.tutor_id||!!previewError}>Send booking request</Button>
    </form>}
    <div style={panel}><h3>{manager?'Planning calendar':'Your classes, requests and exams'}</h3><SessionCalendar sessions={data.classes} requests={bookingCalendarItems(data.requests)} exams={data.exams} onSelectRequest={reviewRequest}/>
      <BookingExams students={students} exams={data.exams} service={service} busy={busy} mutate={mutate}/>
    </div>
    <div style={row}><h3>{manager?'Request inbox':'Your requests'} ({data.requests.filter(activeRequest).length} awaiting action)</h3><Field label="Show"><select value={filter} onChange={e=>setFilter(e.target.value)}><option>Active</option><option>All</option><option>Confirmed</option><option>Declined</option><option>Withdrawn</option></select></Field></div>
    {visible.map(r=><BookingReviewCard key={`${r.id}:${r.version}`} request={r} manager={manager} classes={data.classes} exams={data.exams} busy={busy} onRespond={(request,action,changes,note)=>mutate(()=>service.reviewBookingRequest(request,action,changes,note),action==='propose'?'Alternative sent. Waiting for family acceptance.':action==='confirm'||action==='accept'?'Schedule confirmed and added to the calendar.':'Request updated.')}/>)}
    {visible.length===0&&<p>No requests to show.</p>}
  </section>;
}
