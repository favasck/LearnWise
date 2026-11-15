import React, { useState } from 'react';
import { Button, Field } from '../ui';
import { bookingTime, qatarInput, qatarInstant } from '../services/booking';
import { bookingGrid } from './BookingFields';

export default function BookingExams({students,exams,service,busy,mutate}) {
  const empty={student_id:'',title:'',time:'',duration_min:60,notes:''};
  const [form,setForm]=useState(empty),[editing,setEditing]=useState(null);
  const update=(key,value)=>setForm(f=>({...f,[key]:value}));
  return <details style={{margin:'18px 0'}}><summary>Student exam dates</summary>
    <p>Add school or examination dates so they appear beside booking requests. An exam blocks overlapping new classes for that student.</p>
    <form onSubmit={e=>{e.preventDefault();const values={title:form.title.trim(),scheduled_at:qatarInstant(form.time),duration_min:Number(form.duration_min),notes:form.notes};if(!editing)values.student_id=form.student_id;
      mutate(()=>service.saveStudentExam(values,editing),'Exam date saved.',()=>{setEditing(null);setForm(empty);});}}>
      <div style={bookingGrid}>
        <Field label="Exam student" required><select disabled={!!editing} value={form.student_id} onChange={e=>update('student_id',e.target.value)}><option value="">Choose student</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
        <Field label="Exam name / subject" required><input maxLength={160} value={form.title} onChange={e=>update('title',e.target.value)}/></Field>
        <Field label="Exam date and time (Qatar)" required><input type="datetime-local" value={form.time} onChange={e=>update('time',e.target.value)}/></Field>
        <Field label="Exam duration (minutes)" required><input type="number" min="15" max="480" value={form.duration_min} onChange={e=>update('duration_min',e.target.value)}/></Field>
      </div><Field label="Exam notes"><textarea maxLength={2000} value={form.notes} onChange={e=>update('notes',e.target.value)}/></Field>
      <Button type="submit" disabled={busy}>{editing?'Save exam changes':'Add exam date'}</Button>{editing&&<Button variant="ghost" onClick={()=>{setEditing(null);setForm(empty);}}>Cancel edit</Button>}
    </form>
    {exams.length===0?<p>No exam dates recorded.</p>:exams.map(exam=><div key={exam.id} style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginTop:12}}><span>{exam.student?.full_name} · {exam.title} · {bookingTime(exam.scheduled_at)}</span>
      <Button variant="ghost" disabled={busy} onClick={()=>{setEditing(exam.id);setForm({student_id:exam.student_id,title:exam.title,time:qatarInput(exam.scheduled_at),duration_min:exam.duration_min,notes:exam.notes||''});}}>Edit exam</Button>
      <Button variant="ghost" disabled={busy} onClick={()=>mutate(()=>service.removeStudentExam(exam.id),'Exam date removed from the calendar.')}>Remove exam</Button>
    </div>)}
  </details>;
}
