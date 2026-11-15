import React, {useRef,useState} from 'react';
import {Button,Field} from '../ui';
import * as db from '../services/supabaseData';
import {commandStaff,parseStudentCommand,matchingStudents,loadCommandStudents,executeStudentCreate} from './studentCommands';

export default function StudentCommandBox({role,tutorId,service=db,onCreated}) {
  const [text,setText]=useState(''),[plan,setPlan]=useState(null),[rows,setRows]=useState([]),[selected,setSelected]=useState(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[samePerson,setSamePerson]=useState(false);
  const lock=useRef(false),resultRef=useRef(null);
  const [attempted,setAttempted]=useState(false);
  const staff=commandStaff(role);
  if (!staff && role!=='tutor') return null;
  const focusResult=()=>setTimeout(()=>resultRef.current?.focus(),0);
  async function interpret(event) {
    event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');setSelected(null);setPlan(null);setRows([]);setSamePerson(false);setAttempted(false);
    try {
      const parsed=parseStudentCommand(text);
      const students=await loadCommandStudents(service,role,tutorId);
      setRows(students);
      setPlan({...parsed,id:crypto.randomUUID()});focusResult();
    } catch(e){setError(e.message);} finally{lock.current=false;setBusy(false);}
  }
  async function save() {
    if(lock.current||!plan||plan.intent!=='create')return;
    lock.current=true;setBusy(true);setError('');setAttempted(true);
    try {
      const student=await executeStudentCreate({service,role,id:plan.id,fields:plan.fields});
      setSelected(student);setPlan(null);setMessage(`Student record created: ${student.full_name}. No invitation was sent.`);focusResult();onCreated?.(student);
    }catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}
  }
  const edit=(key,value)=>{if(attempted)return;setPlan(p=>({...p,fields:{...p.fields,[key]:value}}));setSamePerson(false);};
  const matches=plan?matchingStudents(rows,plan.fields.full_name,plan.intent==='create'):[];
  return <section className="student-command-box" aria-label="Student command workspace">
    <form onSubmit={interpret}>
      <Field label="Tell LearnWise what to do"><input value={text} maxLength={600} disabled={busy} onChange={e=>setText(e.target.value)} placeholder="Add student Naila, or find student Naila" aria-describedby="student-command-help"/></Field>
      <p id="student-command-help">Start with Add student or Find student. Optional details: Year 8, subject: Maths, curriculum: IGCSE.</p>
      <Button type="submit" disabled={busy||!text.trim()}>{busy?'Working…':'Review task'}</Button>
    </form>
    {error&&<p role="alert">{error}</p>}
    {message&&<p role="status">{message}</p>}
    <div ref={resultRef} tabIndex={-1}>
      {plan?.intent==='create'&&<div className="student-command-preview">
        <h3>{staff?'Create student record':'Student draft'}</h3>
        {!staff&&<p role="status">Only authorized staff can create students. These details are an editable draft; they have not been saved. Ask your administrator to add the student.</p>}
        <fieldset disabled={busy||attempted} style={{border:0,padding:0,margin:0}}><legend>Student details</legend>
        <Field label="Student name" required><input maxLength={150} disabled={busy} value={plan.fields.full_name} onChange={e=>edit('full_name',e.target.value)}/></Field>
        <div className="student-command-fields">
          <Field label="Grade (optional)"><input maxLength={100} disabled={busy} value={plan.fields.grade} onChange={e=>edit('grade',e.target.value)}/></Field>
          <Field label="Subjects (optional, separated by commas)"><input maxLength={300} disabled={busy} value={plan.fields.subjects.join(', ')} onChange={e=>edit('subjects',e.target.value.split(','))}/></Field>
          <Field label="Curriculum (optional)"><input maxLength={150} disabled={busy} value={plan.fields.curriculum} onChange={e=>edit('curriculum',e.target.value)}/></Field>
        </div>
        </fieldset>
        {attempted&&error&&<p>Retry this unchanged preview to check whether the record was saved before starting another task.</p>}
        <p>Creates an active student record. Where automatic family setup is enabled, a “Parent of {plan.fields.full_name}” placeholder is also created. No login, invitation or tutor assignment is created.</p>
        {!!matches.length&&<div><p>Existing students with this name:</p>{matches.map(s=><button type="button" className="button button--ghost" key={s.id} disabled={busy} onClick={()=>setSelected(s)}>{s.full_name} · {s.grade||'Grade not recorded'} · {s.school||'School not recorded'}</button>)}<label><input type="checkbox" checked={samePerson} disabled={busy} onChange={e=>setSamePerson(e.target.checked)}/> This is a different student with the same name</label></div>}
        {staff&&<Button disabled={busy||!plan.fields.full_name.trim()||(matches.length>0&&!samePerson)} onClick={save}>{busy?'Saving…':'Create student record'}</Button>}
        <Button variant="ghost" disabled={busy} onClick={()=>{setPlan(null);setSelected(null);}}>Close preview</Button>
      </div>}
      {plan?.intent==='find'&&<div><h3>Matching students</h3>{matches.length?matches.map(s=><button type="button" className="button button--ghost" key={s.id} onClick={()=>setSelected(s)}>{s.full_name} · {s.grade||'Grade not recorded'} · {s.school||'School not recorded'}</button>):<p>No accessible students match this name. Try part of the name or check the spelling.</p>}</div>}
      {selected&&<article className="student-command-preview" aria-label="Selected student"><h3>{selected.full_name}</h3><p>{[selected.grade,selected.school,selected.curriculum].filter(Boolean).join(' · ')||'Learning details not recorded yet.'}</p><p>Subjects: {(selected.subjects||[]).join(', ')||'Not recorded'}</p><p>Status: {selected.status||'Not recorded'}</p><Button variant="ghost" onClick={()=>setSelected(null)}>Close student details</Button></article>}
    </div>
  </section>;
}
