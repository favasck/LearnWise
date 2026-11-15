import React, { useState } from 'react';
import { Button, Field } from '../ui';
import { bookingGrid } from './BookingFields';
import { qatarInput, qatarInstant } from '../services/booking';
import { calendarEntryPayload } from '../services/masterCalendar';

export default function MasterCalendarEditor({event,onSave,onCancel,busy,lockVisibility=false}) {
  const [form,setForm]=useState(()=>({title:'',category:'Task',visibility:'private',starts_on:qatarInput(new Date()).slice(0,10),ends_on:qatarInput(new Date()).slice(0,10),all_day:true,duration_min:60,board:'',syllabus:'',paper:'',zone:'',series:'',session_label:'',source_url:'',notes:'',task_status:'Open',...event,time:event?.starts_at?qatarInput(event.starts_at).slice(11):'09:00',verification:event?.verification==='Provisional'?'Provisional':event?.verification==='Centre confirmed'?'Centre confirmed':'Tutor entered'}));
  const update=(key,value)=>setForm(f=>({...f,[key]:value,...(key==='starts_on'&&value>f.ends_on?{ends_on:value}:{})}));
  return <form onSubmit={e=>{e.preventDefault();const starts_at=form.all_day?null:qatarInstant(`${form.starts_on}T${form.time}`),duration_min=form.duration_min?Number(form.duration_min):null;
    onSave(calendarEntryPayload(form,{starts_at,duration_min,ends_on:form.all_day?form.ends_on:qatarInput(new Date(new Date(starts_at).getTime()+duration_min*60000-1)).slice(0,10),deleted_at:null}));}}>
    <h3>{event?'Edit calendar entry':'Add a calendar entry'}</h3>
    <div style={bookingGrid}>
      <Field label="Event title" required><input maxLength={220} value={form.title} onChange={e=>update('title',e.target.value)}/></Field>
      <Field label="Event category"><select value={form.category} onChange={e=>update('category',e.target.value)}><option value="Exam">Exam date</option><option value="QatarHoliday">Qatar holiday / major date</option><option value="Task">Task</option><option value="Other">Other date</option></select></Field>
      <Field label="Visible to" hint="Shared master dates are visible to all active LearnWise accounts. Keep personal tasks private."><select disabled={!!event?.catalog_key||lockVisibility} value={form.visibility} onChange={e=>update('visibility',e.target.value)}><option value="shared">Everyone · shared master calendar</option><option value="private">Only me and Super Admin</option></select></Field>
      <Field label="Date" required><input type="date" value={form.starts_on} onChange={e=>update('starts_on',e.target.value)}/></Field>
      <Field label="End date (inclusive)" required hint="For timed entries, the end date is calculated from the duration."><input type="date" disabled={!form.all_day} min={form.starts_on} value={form.ends_on} onChange={e=>update('ends_on',e.target.value)}/></Field>
    </div>
    <label style={{display:'flex',gap:8,margin:'16px 0'}}><input type="checkbox" checked={form.all_day} onChange={e=>update('all_day',e.target.checked)}/>Date only / no confirmed local start time</label>
    {!form.all_day&&<div style={bookingGrid}><Field label="Start time (Qatar)" required><input type="time" value={form.time} onChange={e=>update('time',e.target.value)}/></Field><Field label="Duration (minutes)" required><input type="number" min="1" max="1440" value={form.duration_min||''} onChange={e=>update('duration_min',e.target.value)}/></Field></div>}
    {form.category==='Exam'&&<div style={bookingGrid}>
      <Field label="Exam board"><select value={['','Cambridge','Pearson Edexcel'].includes(form.board)?form.board:'Other'} onChange={e=>update('board',e.target.value)}><option value="">Other / school exam</option><option>Cambridge</option><option>Pearson Edexcel</option><option>Other</option></select></Field>
      <Field label="Syllabus / subject code"><input maxLength={40} value={form.syllabus} onChange={e=>update('syllabus',e.target.value)}/></Field>
      <Field label="Paper"><input maxLength={40} value={form.paper} onChange={e=>update('paper',e.target.value)}/></Field>
      <Field label="Zone / region"><input maxLength={100} value={form.zone} onChange={e=>update('zone',e.target.value)}/></Field>
      <Field label="Exam series"><input maxLength={100} value={form.series} onChange={e=>update('series',e.target.value)}/></Field>
      <Field label="Timetable session"><input maxLength={100} value={form.session_label} placeholder="AM, PM, or practical window" onChange={e=>update('session_label',e.target.value)}/></Field>
    </div>}
    <div style={bookingGrid}><Field label="Date status"><select value={form.verification} onChange={e=>update('verification',e.target.value)}><option>Tutor entered</option><option>Provisional</option><option>Centre confirmed</option></select></Field>
      <Field label="Source link"><input type="url" pattern="https://.*" maxLength={1000} placeholder="https://…" value={form.source_url} onChange={e=>update('source_url',e.target.value)}/></Field>
      {form.category==='Task'&&<Field label="Task status"><select value={form.task_status} onChange={e=>update('task_status',e.target.value)}><option>Open</option><option>Done</option></select></Field>}
    </div><Field label="Event notes"><textarea maxLength={3000} value={form.notes} onChange={e=>update('notes',e.target.value)}/></Field>
    {event?.catalog_key&&<p>Saving replaces this published reference date in the shared master calendar. The source link remains available for comparison.</p>}
    <div style={{display:'flex',gap:12}}><Button type="submit" disabled={busy}>Save calendar entry</Button><Button variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button></div>
  </form>;
}
