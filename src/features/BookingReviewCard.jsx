import React, { useState } from 'react';
import { Button, Field, tokens } from '../ui';
import { activeRequest, bookingTime, defaultRecurrence, durationLabel, nearbyClasses, qatarInput, qatarInstant, recurrenceLabel, recurrenceTimes } from '../services/booking';
import { bookingGrid, DurationField, RecurrenceFields } from './BookingFields';

export default function BookingReviewCard({request:r,manager,classes=[],exams=[],busy,onRespond}) {
  const [proposal,setProposal]=useState({time:qatarInput(r.scheduled_at),duration_min:r.duration_min,mode:r.mode,location:r.location||'',recurrence:r.recurrence||defaultRecurrence()});
  const [note,setNote]=useState(''),[proposing,setProposing]=useState(false);
  const update=(key,value)=>setProposal(p=>({...p,[key]:value}));
  let preview=[],previewError='';
  try{preview=recurrenceTimes(qatarInstant(proposal.time),proposal.recurrence);}catch(e){previewError=e.message;}
  const changes=()=>({scheduled_at:qatarInstant(proposal.time),duration_min:Number(proposal.duration_min),mode:proposal.mode,location:proposal.mode==='Offline'?proposal.location.trim():'',recurrence:proposal.recurrence});
  return <article id={`booking-${r.id}`} tabIndex={-1} style={{background:'white',border:`1px solid ${tokens.line}`,borderRadius:14,padding:20,marginBottom:18}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12}}><strong>{r.student_name||r.student?.full_name||'Student'} · {r.subject}</strong><span className="eyebrow">{r.status}</span></div>
    <p>{bookingTime(r.scheduled_at)} · {durationLabel(r.duration_min)} · {r.tutor?.full_name||'Tutor'}</p>
    <p>{r.mode==='Online'?'Online':`In person · ${r.location}`} · {recurrenceLabel(r.recurrence)}</p>
    {r.student_details&&<p>Student details: {r.student_details}</p>}{r.notes&&<p>Family notes: {r.notes}</p>}{r.response_note&&<p>Latest response: {r.response_note}</p>}
    <details><summary>Requested dates and activity</summary>
      <p>Preferred first-session times: {r.preferred_times.map(bookingTime).join(' / ')}</p>
      <ol>{(r.occurrence_times||[r.scheduled_at]).map(time=><li key={time}>{bookingTime(time)}</li>)}</ol>
      <h4>Activity</h4><ol>{[...(r.booking_events||[])].sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(e=><li key={e.id}>{e.status} · {bookingTime(e.scheduled_at)}{e.details?.duration_min&&` · ${durationLabel(e.details.duration_min)} · ${e.details.mode==='Offline'?'In person':'Online'} · ${recurrenceLabel(e.details.recurrence)}`}{e.details?.location&&` · ${e.details.location}`}{e.note&&` · ${e.note}`}</li>)}</ol>
    </details>
    {manager&&activeRequest(r)&&<details style={{marginTop:12}}><summary>Classes, locations and exams on this day</summary>
      {nearbyClasses(classes.filter(c=>c.tutor_id===r.tutor_id),proposing?qatarInstant(proposal.time):r.scheduled_at).map(c=><p key={c.id}>{bookingTime(c.scheduled_at)} · {durationLabel(c.duration_min)} · {c.student?.full_name} · {c.mode==='Online'?'Online':c.location||'Location not recorded'}</p>)}
      {nearbyClasses(exams,proposing?qatarInstant(proposal.time):r.scheduled_at).map(e=><p key={e.id}>Exam · {e.student?.full_name} · {e.title} · {bookingTime(e.scheduled_at)}</p>)}
      <p>Check the calendar for all repeat dates. Every occurrence is checked again at confirmation.</p>
    </details>}
    {activeRequest(r)&&<div style={{marginTop:16}}><Field label={manager?'Response / reason':'Optional reply'}><textarea maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></Field>
      {manager?<>
        {proposing&&<div><div style={bookingGrid}>
          <Field label="Alternative time (Qatar)" required><input type="datetime-local" value={proposal.time} onChange={e=>update('time',e.target.value)}/></Field>
          <DurationField label="Proposed session length" value={proposal.duration_min} onChange={v=>update('duration_min',v)}/>
          <Field label="Proposed class mode"><select value={proposal.mode} onChange={e=>update('mode',e.target.value)}><option value="Online">Online</option><option value="Offline">In person</option></select></Field>
          {proposal.mode==='Offline'&&<Field label="Proposed class location" required><input maxLength={500} value={proposal.location} onChange={e=>update('location',e.target.value)}/></Field>}
        </div><RecurrenceFields value={proposal.recurrence} onChange={v=>update('recurrence',v)} firstTime={proposal.time} labelPrefix="Proposed "/></div>}
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:12}}>
          {r.status==='Pending'&&<Button disabled={busy} onClick={()=>onRespond(r,'confirm',{},note)}>Confirm requested schedule</Button>}
          <Button variant="secondary" disabled={busy} onClick={()=>setProposing(!proposing)}>{proposing?'Close changes':'Change date, hours or mode'}</Button>
          {proposing&&<Button disabled={busy||!preview.length||!!previewError||(proposal.mode==='Offline'&&!proposal.location.trim())} onClick={()=>onRespond(r,'propose',changes(),note)}>Send alternative</Button>}
          <Button variant="ghost" disabled={busy||!note.trim()} onClick={()=>onRespond(r,'decline',{},note)}>Decline with reason</Button>
        </div>{r.status==='Proposed'&&<p>Waiting for the family to accept these details. No sessions are reserved yet.</p>}
      </>:<div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        {r.status==='Proposed'&&<Button disabled={busy} onClick={()=>onRespond(r,'accept',{},note)}>Accept alternative</Button>}
        <Button variant="ghost" disabled={busy} onClick={()=>onRespond(r,'withdraw',{},note)}>Withdraw request</Button>
      </div>}
    </div>}
    {r.status==='Confirmed'&&<p role="status">Confirmed sessions are in the class calendar. Further changes are managed from Classes.</p>}
  </article>;
}
