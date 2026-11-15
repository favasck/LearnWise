import React, { useEffect, useMemo, useState } from 'react';
import { Button, Field, Modal, tokens } from '../ui';
import * as db from '../services/supabaseData';
import { qatarInput } from '../services/booking';
import { CALENDAR_CATEGORIES, CALENDAR_CHECKED_ON, CALENDAR_SOURCES, canManageCalendar, calendarEntryPayload, filterCalendarEntries, masterCalendarEntries, officialExamEntries, qatarHolidayEntries } from '../services/masterCalendar';
import MasterCalendarGrid, { calendarColors, eventWhen } from './MasterCalendarGrid';
import MasterCalendarEditor from './MasterCalendarEditor';
import { bookingGrid } from './BookingFields';

const panel={background:'white',border:`1px solid ${tokens.line}`,borderRadius:14,padding:20,marginBottom:18};
const flex={display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'};
const emptyData={entries:[],classes:[],exams:[],requests:[],homework:[]};
export default function MasterCalendar({role,userId,service=db,onNavigate}) {
  const manager=canManageCalendar(role),root=['super_admin','admin'].includes(role);
  const [data,setData]=useState(emptyData),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [ready,setReady]=useState(false);
  const [month,setMonth]=useState(()=>qatarInput(new Date()).slice(0,7)),[view,setView]=useState(()=>typeof window!=='undefined'&&window.matchMedia?.('(max-width:760px)').matches?'agenda':'month');
  const [categories,setCategories]=useState(Object.keys(CALENDAR_CATEGORIES)),[board,setBoard]=useState(''),[search,setSearch]=useState(''),[taskStatus,setTaskStatus]=useState(''),[removed,setRemoved]=useState(false);
  const [selected,setSelected]=useState(null),[day,setDay]=useState(''),[editor,setEditor]=useState(null);
  async function load(){setLoading(true);setReady(false);setError('');try{
    const results=await Promise.all([service.getMasterCalendarEntries(),service.getClasses(),service.getStudentExams(),service.getBookingRequests(),service.getHomework()]);
    const failure=results.find(r=>r.error);
    if(failure){setError(`${failure.error.message} The calendar may be incomplete until refreshed.`);return false;}
    setData(Object.fromEntries(['entries','classes','exams','requests','homework'].map((key,i)=>[key,results[i].data||[]])));setReady(true);return true;
  }catch{setError('Unable to load saved calendar entries. Refresh to retry.');return false;}finally{setLoading(false);}}
  useEffect(()=>{load();},[role,userId]);
  const calendarYear=Number(month.slice(0,4));
  const catalogue=useMemo(()=>[...officialExamEntries(),...qatarHolidayEntries([calendarYear])],[calendarYear]);
  const all=useMemo(()=>masterCalendarEntries(data,catalogue),[data,catalogue]);
  const events=useMemo(()=>filterCalendarEntries(all,{categories,month,board,search,taskStatus,showRemoved:manager&&removed}),[all,categories,month,board,search,taskStatus,manager,removed]);
  const boards=[...new Set(all.filter(e=>e.category==='Exam'&&e.board).map(e=>e.board))].sort();
  function shift(delta){const[y,m]=month.split('-').map(Number);setMonth(new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7));setDay('');}
  const editable=event=>manager&&['catalog','calendar'].includes(event.origin)&&(event.origin==='catalog'||event.visibility==='shared'||event.owner_user_id===userId||root);
  async function save(entry,values,success){if(!ready){setError('Refresh the calendar before saving changes.');return;}setBusy(true);setError('');setMessage('');try{
    const result=await service.saveMasterCalendarEntry(values,entry);if(result.error){setError(`${result.error.message} Refresh if another tutor changed this entry.`);return;}
    setEditor(null);setSelected(null);const refreshed=await load();setMessage(refreshed?success:'Saved. Refresh to see the latest calendar.');
  }catch{setError('Unable to save. Your edits have been kept; please retry.');}finally{setBusy(false);}}
  const select=event=>{setSelected(event);setDay('');};
  function manageOperational(event){const destination=event.origin==='class'?(role==='tutor'||role==='student'?'/portal/myclasses':'/portal/classes'):event.origin==='homework'?'/portal/homework':'/portal/bookings';onNavigate?.(destination);}
  const entryButton=event=><button key={event.id} type="button" onClick={()=>select(event)} style={{textAlign:'left',width:'100%',border:`1px solid ${tokens.line}`,background:calendarColors[event.category],borderRadius:10,padding:14,marginBottom:8,cursor:'pointer',opacity:event.deleted_at?0.5:1}}>
    <strong>{event.title}</strong><div>{event.starts_on}{event.ends_on!==event.starts_on?` – ${event.ends_on}`:''} · {eventWhen(event)}</div><small>{CALENDAR_CATEGORIES[event.category]}{event.board?` · ${event.board}`:''}{event.zone?` · ${event.zone==='3'?'Zone 3':event.zone}`:''} · {event.verification||event.task_status||''}{event.deleted_at?' · Removed':''}</small>
  </button>;
  return <section aria-label="Master calendar">
    <div style={{...flex,justifyContent:'space-between'}}><div><h2>Master calendar</h2><p>Major dates, exams, classes and tasks in one place. All local times use Qatar (UTC+3).</p></div><div style={flex}><Button variant="ghost" disabled={loading||busy} onClick={load}>Refresh calendar</Button>{manager&&<Button disabled={loading||busy||!ready} onClick={()=>{setEditor({event:null});setSelected(null);}}>Add calendar entry</Button>}</div></div>
    {error&&<p role="alert" style={panel}>{error}</p>}{message&&<p role="status">{message}</p>}{loading&&<p role="status">Loading calendar records…</p>}
    <div style={panel}>
      <div style={{...flex,marginBottom:14}}><Button variant="ghost" aria-label="Previous calendar month" onClick={()=>shift(-1)}>Previous</Button><Field label="Master calendar month"><input type="month" value={month} onChange={e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)){setMonth(e.target.value);setDay('');}}}/></Field><Button variant="ghost" aria-label="Next calendar month" onClick={()=>shift(1)}>Next</Button><Button variant="ghost" onClick={()=>setMonth(qatarInput(new Date()).slice(0,7))}>This month</Button><Field label="Calendar view"><select value={view} onChange={e=>setView(e.target.value)}><option value="month">Month</option><option value="agenda">Agenda</option></select></Field></div>
      <fieldset style={{border:`1px solid ${tokens.line}`,borderRadius:10,padding:12}}><legend>Show together or filter by type</legend><div style={flex}>{Object.entries(CALENDAR_CATEGORIES).map(([key,label])=><label key={key} style={{...flex,gap:6}}><input type="checkbox" checked={categories.includes(key)} onChange={e=>setCategories(c=>e.target.checked?[...c,key]:c.filter(k=>k!==key))}/><span style={{width:10,height:10,background:calendarColors[key],border:'1px solid #aaa',borderRadius:2}}/>{label}</label>)}</div><div style={{...flex,marginTop:10}}><Button variant="ghost" onClick={()=>{setCategories(Object.keys(CALENDAR_CATEGORIES));setBoard('');setSearch('');setTaskStatus('');setRemoved(false);}}>Show all types</Button><Button variant="ghost" onClick={()=>setCategories([])}>Clear types</Button></div></fieldset>
      <div style={{...bookingGrid,marginTop:16}}><Field label="Exam board"><select value={board} onChange={e=>setBoard(e.target.value)}><option value="">All exam boards</option>{boards.map(b=><option key={b}>{b}</option>)}</select></Field><Field label="Search calendar"><input type="search" placeholder="Subject, paper code, title, series…" value={search} onChange={e=>setSearch(e.target.value)}/></Field><Field label="Task filter"><select value={taskStatus} onChange={e=>setTaskStatus(e.target.value)}><option value="">All tasks</option><option value="Open">Open tasks</option><option value="Done">Completed tasks</option></select></Field></div>
      {manager&&<label style={flex}><input type="checkbox" checked={removed} onChange={e=>setRemoved(e.target.checked)}/>Include removed master entries for restoration</label>}
      <p role="status">{events.length} matching calendar {events.length===1?'entry':'entries'} in {month}.</p>
      {view==='month'?<MasterCalendarGrid month={month} events={events} onSelect={select} onDay={setDay}/>:<div aria-label="Calendar agenda">{events.map(entryButton)}</div>}
      {events.length===0&&<p>No matching dates. Choose another month, change the filters, or add an entry.</p>}
    </div>
    <details style={panel}><summary>Published date coverage and sources</summary><p>Reference dates checked {CALENDAR_CHECKED_ON}. Cambridge catalogue: Zone 3. Pearson catalogue: standard non-R papers. Confirm your centre's zone, actual paper entry and local start time. These reference dates do not book a student for an exam or block every tutor's classes.</p><ul>{CALENDAR_SOURCES.map(s=><li key={s.key}><a href={s.source_url} target="_blank" rel="noreferrer">{s.board} · {s.series} · {s.zone==='3'?'Zone 3':s.zone}</a> · {s.count} papers/windows</li>)}</ul><p>Qatar National Day and Sports Day follow <a href="https://www.cm.gov.qa/en/Pages/official_holidays.aspx" target="_blank" rel="noreferrer">official holiday rules</a>. Eid and Ramadan dates are estimated Hijri conversions and marked provisional until announced. Ramadan is an observance, not a public holiday.</p></details>
    {editor&&<Modal title={editor.event?'Edit calendar entry':'Add calendar entry'} onClose={()=>{if(!busy)setEditor(null);}} wide>{error&&<p role="alert">{error}</p>}<MasterCalendarEditor event={editor.event} busy={busy} lockVisibility={editor.event?.origin==='calendar'&&editor.event.owner_user_id!==userId&&!root} onCancel={()=>setEditor(null)} onSave={values=>save(editor.event,values,'Calendar entry saved.')}/></Modal>}
    {day&&!selected&&<Modal title={`Calendar · ${day}`} onClose={()=>setDay('')} wide>{events.filter(e=>e.starts_on<=day&&e.ends_on>=day).map(entryButton)}{!events.some(e=>e.starts_on<=day&&e.ends_on>=day)&&<p>No matching entries on this day.</p>}</Modal>}
    {selected&&!editor&&<Modal title={selected.title} onClose={()=>{if(!busy)setSelected(null);}} wide>
      {error&&<p role="alert">{error}</p>}
      <p><strong>{CALENDAR_CATEGORIES[selected.category]}</strong> · {selected.starts_on}{selected.ends_on!==selected.starts_on?` – ${selected.ends_on}`:''}</p><p>{eventWhen(selected)}{selected.duration_min&&selected.all_day?` · paper duration ${selected.duration_min} min`:''}</p>
      <p>{[selected.board,selected.series,selected.zone==='3'?'Zone 3':selected.zone,selected.verification].filter(Boolean).join(' · ')}</p>{selected.notes&&<p style={{whiteSpace:'pre-wrap'}}>{selected.notes}</p>}
      {selected.visibility&&<p>Visibility: {selected.visibility==='private'?'Private task/date':'Shared master calendar'}</p>}
      {selected.source_url&&<p><a href={selected.source_url} target="_blank" rel="noreferrer">View source{selected.source_page?` · page ${selected.source_page}`:''}</a></p>}
      {selected.original&&<p>Original published date: {selected.original.starts_on}{selected.original.ends_on!==selected.original.starts_on?` – ${selected.original.ends_on}`:''}. This entry was changed by a tutor.</p>}
      {editable(selected)?<div style={flex}>
        {!selected.deleted_at&&<Button disabled={busy||!ready} onClick={()=>setEditor({event:selected})}>Edit date or details</Button>}
        {selected.category==='Task'&&!selected.deleted_at&&<Button variant="secondary" disabled={busy||!ready} onClick={()=>save(selected,calendarEntryPayload(selected,{task_status:selected.task_status==='Done'?'Open':'Done'}),'Task updated.')}>{selected.task_status==='Done'?'Mark task open':'Mark task done'}</Button>}
        <Button variant="ghost" disabled={busy||!ready} onClick={()=>save(selected,calendarEntryPayload(selected,{verification:selected.verification==='Published timetable'||selected.verification==='Official rule'?'Tutor entered':selected.verification,deleted_at:selected.deleted_at?null:new Date().toISOString()}),selected.deleted_at?'Calendar entry restored.':'Calendar entry removed. Use the removed-entry filter to restore it.')}>
          {selected.deleted_at?'Restore entry':selected.visibility==='private'?'Remove private entry':'Remove shared date for everyone'}
        </Button>
      </div>:['class','exam','request','homework'].includes(selected.origin)&&<Button onClick={()=>manageOperational(selected)}>Manage in {selected.origin==='class'?'Classes':selected.origin==='homework'?'Homework':selected.origin==='exam'?'Exam dates':'Bookings'}</Button>}
      {selected.visibility==='shared'&&editable(selected)&&<p>Changes to this shared master date apply to everyone. Classes and student-specific exam records are managed separately.</p>}
    </Modal>}
  </section>;
}

