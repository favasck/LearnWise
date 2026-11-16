import React,{useRef,useState} from 'react';
import {Button,Field} from '../ui';
import * as db from '../services/supabaseData';
import {commandStaff} from './studentCommands';
import {createMessagingService} from '../services/messaging';
import {supabase} from '../supabaseClient';
import {COMMAND_ENTITIES,commandExamples,commandLabel,parseTaskCommand,prepareTask,selectTaskTarget,changeTaskValue,fieldsFor,rowLabel,filterCommandRows,validateTask,runTask} from './taskCommands';

const routes={student:'students',parent:'parents',tutor:'tutors',class:'classes',homework:'homework',material:'materials',note:'classnotes',calendar:'calendar',exam:'bookings',request:'bookings',availability:'bookings',enquiry:'assessments',report:'reports',assignment:'students'};
const display=value=>value===null||value===undefined||value===''?'Not recorded':Array.isArray(value)?value.join(', '):typeof value==='boolean'?(value?'Yes':'No'):String(value);
const resultFields={full_name:'Name',title:'Title',student_name:'Student',parent_name:'Parent',grade:'Grade',school:'School',curriculum:'Curriculum',subjects:'Subjects',subject:'Subject',topic:'Topic',attendance:'Attendance',understanding:'Understanding',status:'Status',summary:'Summary',description:'Description',tutor_feedback:'Feedback',response_note:'Response',notes:'Notes',starts_on:'Date',ends_on:'End date',visibility:'Visibility',task_status:'Task status',email:'Email',phone:'Phone',file_url:'Resource link',amount_qar:'Amount (QAR)',total_qar:'Total (QAR)',balance_qar:'Balance (QAR)'};
function RecordCard({row,entity}){
  return <article className="student-command-preview" aria-label={entity==='student'?'Selected student':'Record details'}><h4>{rowLabel(entity,row)}</h4>
    <dl className="task-command-record">{Object.entries(resultFields).filter(([key])=>row[key]!==undefined&&row[key]!==null&&row[key]!=='').map(([key,label])=><React.Fragment key={key}><dt>{label}</dt><dd>{display(row[key])}</dd></React.Fragment>)}</dl>
  </article>;
}
export default function TaskCommandBox({role,tutorId,userId,service=db,onCreated,onNavigate}){
  const [text,setText]=useState(''),[plan,setPlan]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [reviewing,setReviewing]=useState(false),[attempted,setAttempted]=useState(false),[ack,setAck]=useState(false),[output,setOutput]=useState(null),[selected,setSelected]=useState(null),[limit,setLimit]=useState(20);
  const lock=useRef(false),heading=useRef(null),composer=useRef(null),context={role,tutorId,userId};
  if(!commandStaff(role)&&role!=='tutor')return null;
  const examples=commandExamples(role);
  const focus=()=>setTimeout(()=>heading.current?.focus(),0);
  async function prepare(event){
    event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');setPlan(null);setOutput(null);setSelected(null);setReviewing(false);setAttempted(false);setAck(false);setLimit(20);
    try{
      let next=await prepareTask(parseTaskCommand(text),service,context);
      if(next.entity==='message'){
        const c=await createMessagingService(supabase).contacts();if(c.error)throw Error('Unable to load contacts. Open Inbox to retry.');
        const hits=(c.data||[]).filter(x=>x.id===next.target.id);if(hits.length!==1)throw Error('Account unavailable. Choose an active user in Inbox.');setPlan(next);
      }else if(next.op==='list'){
        const result=await runTask(next,service,context);setPlan(next);setOutput(result.rows);setMessage(`${result.rows.length} accessible ${next.entity==='report'?'report records':'matching records'}.`);
      }else{
        const matches=filterCommandRows(next,next.refs.target||[]);
        if(next.op!=='create'&&matches.length===1)next=selectTaskTarget(next,matches[0].id);
        setPlan(next);
      }
      focus();
    }catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}
  }
  const change=(key,value)=>{if(attempted)return;setPlan(p=>changeTaskValue(p,key,value));setReviewing(false);setAck(false);setError('');};
  const choose=id=>{try{setPlan(p=>selectTaskTarget(p,id));setReviewing(false);setError('');}catch(e){setError(e.message);}};
  const close=()=>{setPlan(null);setOutput(null);setSelected(null);setReviewing(false);setError('');setAttempted(false);composer.current?.focus();};
  function review(event){event.preventDefault();try{validateTask(plan,context);setReviewing(true);setError('');focus();}catch(e){setError(e.message);}}
  async function save(){
    if(lock.current||!reviewing)return;lock.current=true;setBusy(true);setError('');setAttempted(true);
    try{
      if(plan.entity==='message'){
        const result=await createMessagingService(supabase).send(userId,plan.target.id,plan.values.body,crypto.randomUUID());if(result.error)throw result.error;
        setMessage('Message sent to '+plan.target.full_name+'.');setPlan(null);setReviewing(false);setText('');focus();return;
      }
      const result=await runTask(plan,service,context);
      setSelected({...result.record,__entity:plan.entity});setMessage(plan.op==='delete'?'Record removed with retained history.':plan.entity==='request'?'Booking response saved. Check the request status for the next step.':`${commandLabel(plan)} saved.${['student','parent','tutor'].includes(plan.entity)?' No invitation was sent.':''}`);
      setPlan(null);setReviewing(false);onCreated?.(result.record);focus();
    }catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}
  }
  const targets=plan?filterCommandRows(plan,plan.refs.target||[]):[];
  const duplicates=plan?.op==='create'&&['student','parent','tutor'].includes(plan.entity)?(plan.refs.target||[]).filter(r=>r.full_name?.trim().toLowerCase()===plan.values.full_name?.trim().toLowerCase()):[];
  const needsAck=plan&&(['delete','cancel','unlink','linkParent'].includes(plan.op)||(plan.entity==='calendar'&&(plan.values.visibility==='shared'||plan.target?.visibility==='shared'))||duplicates.length>0);
  const unsafeRetry=attempted&&['calendar','exam','availability','request'].includes(plan?.entity);
  function input(field){
    const value=plan.values[field.key]??'';
    const common={value,onChange:e=>change(field.key,e.target.value),disabled:busy||attempted,maxLength:field.max||2000};
    if(field.type==='checkbox')return <input type="checkbox" checked={!!value} onChange={e=>change(field.key,e.target.checked)} disabled={busy||attempted}/>;
    if(field.type==='select')return <select {...common}><option value="">Choose…</option>{field.options.map(option=><option key={option}>{option}</option>)}</select>;
    if(['student','parent','tutor','class'].includes(field.type))return <select {...common} disabled={busy||attempted||(role==='tutor'&&field.type==='tutor')||(plan.entity==='exam'&&plan.op==='update'&&field.type==='student')}><option value="">Choose {field.type}…</option>{(plan.refs[field.type]||[]).map(row=><option key={row.id} value={row.id}>{rowLabel(field.type,row)} · {row.id.slice(0,8)}</option>)}</select>;
    if(field.type==='textarea')return <textarea {...common} rows={3}/>;
    return <input {...common} type={field.type==='array'?'text':field.type} min={field.min} max={field.type==='number'?field.max:undefined}/>;
  }
  const selectedEntity=plan?.entity||selected?.__entity||'';
  return <section className="student-command-box task-command-box" aria-label="LearnWise task workspace">
    <form onSubmit={prepare}>
      <Field label="Tell LearnWise what to do"><input ref={composer} value={text} maxLength={1500} disabled={busy} onChange={e=>setText(e.target.value)} placeholder="Add homework for Naila, mark attendance, or check requests" aria-describedby="task-command-help"/></Field>
      <p id="task-command-help">Type one task. LearnWise fills known details and asks for anything missing. Times are in Qatar. Changes are reviewed before saving.</p>
      <Button type="submit" disabled={busy||!text.trim()}>{busy?'Working…':'Review task'}</Button>
    </form>
    <details className="task-command-examples"><summary>What can I do here?</summary><p>Message a user or reply to an existing conversation by name. Review before sending.</p><p>Add, find, edit or remove records; manage lessons, homework, feedback, materials, exams and calendar entries; review bookings; publish availability; and check reports. Your account permissions apply.</p><div className="task-command-chips">{examples.map(example=><Button variant="ghost" key={example} disabled={busy} onClick={()=>{setText(example);composer.current?.focus();}}>{example}</Button>)}</div><p>Optional details use commas: <strong>Add homework Fractions for Naila, due: tomorrow</strong>. Use explicit times such as 17:00 or 5 PM. For other fields, complete the short task card.</p></details>
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    <div ref={heading} tabIndex={-1}>
      {plan&&<div className="student-command-preview"><h3>{commandLabel(plan)}</h3>
        {plan.draft&&<p role="status">Only authorized staff can create this record. These details are an editable draft; they have not been saved. Ask your administrator to add the record.</p>}
        {plan.op!=='create'&&plan.op!=='list'&&<Field label="Choose the exact record" required><select value={plan.selection} disabled={busy||attempted} onChange={e=>choose(e.target.value)}><option value="">Choose a matching record…</option>{targets.map(row=><option key={row.id} value={row.id}>{rowLabel(plan.entity,row)} · {row.id.slice(0,8)}</option>)}</select></Field>}
        {plan.op!=='create'&&plan.op!=='list'&&!targets.length&&<p>No accessible records match. Change the name or date and try again.</p>}
        {plan.studentName&&!plan.values.student_id&&plan.op==='create'&&<p>Choose which student matches “{plan.studentName}”.</p>}
        {plan.op!=='list'&&(!reviewing?<form onSubmit={review} className="task-command-form">
          <fieldset disabled={busy||attempted}><legend>Task details</legend><div className="student-command-fields">{fieldsFor(plan).filter(field=>plan.entity!=='calendar'||!(['starts_at','duration_min'].includes(field.key)&&plan.values.all_day||['starts_on','ends_on'].includes(field.key)&&!plan.values.all_day)).map(field=><Field key={field.key} label={field.label} required={field.required}>{input(field)}</Field>)}</div></fieldset>
          {plan.target&&<p>Selected: <strong>{rowLabel(plan.entity,plan.target)}</strong></p>}
          {plan.op==='create'&&['student','parent','tutor'].includes(plan.entity)&&<p>Creates an active record. No login, invitation or tutor assignment is created.{plan.entity==='student'?' Where automatic family setup is enabled, an unlinked student gets a “Parent of …” placeholder.':''}</p>}
          {plan.entity==='note'&&<p>Only the selected audiences receive this note in their portal. An email or WhatsApp message is not sent.</p>}
          {plan.entity==='material'&&<p>Choose a specific student or share across your assigned students. This saves a resource link; it does not upload a file.</p>}
          {plan.entity==='request'&&plan.op==='confirm'&&<p>Confirms every occurrence in the existing request. All scheduling checks still apply.</p>}
          {plan.entity==='request'&&plan.op==='propose'&&<p>Keeps the current repeat pattern and proposes these details for family acceptance. No time is reserved until confirmation.</p>}
          {plan.op==='linkParent'&&<p>This changes the student's family link and the parent's access to that student's records. It does not send an invitation.</p>}
          {plan.op==='unlink'&&<p>This revokes the tutor assignment and its future access. Existing lessons and learning records are retained.</p>}
          {plan.day&&plan.op==='create'&&<p>Date supplied: {plan.day} (Qatar). Choose a time if this task needs one.</p>}
          {plan.entity==='calendar'&&<p>{plan.values.visibility==='shared'||plan.target?.visibility==='shared'?'This shared entry affects everyone who can see the master calendar.':'Private entries are visible to you and Super Admin.'} Class times and homework deadlines are managed through their own tasks.</p>}
          {!!duplicates.length&&<div><p>Existing records with the same name:</p>{duplicates.map(row=><Button variant="ghost" key={row.id} onClick={()=>setSelected({...row,__entity:plan.entity})}>{rowLabel(plan.entity,row)} · {row.id.slice(0,8)}</Button>)}</div>}
          {!plan.draft&&<Button type="submit" disabled={busy||attempted||(plan.op!=='create'&&!plan.target)}>Preview changes</Button>}
        </form>:<div aria-label="Task confirmation"><p>{plan.target?rowLabel(plan.entity,plan.target):'New record'}</p><dl className="task-command-record">{fieldsFor(plan).map(field=><React.Fragment key={field.key}><dt>{field.label}</dt><dd>{['student','tutor','parent','class'].includes(field.type)?rowLabel(field.type,plan.refs[field.type]?.find(r=>r.id===plan.values[field.key])||{}):display(plan.values[field.key])}</dd></React.Fragment>)}</dl>
          {plan.op==='delete'&&<p>This removes the selected record from active views while retaining its history. It does not remove related records.</p>}
          {plan.op==='cancel'&&<p>The selected class will be cancelled. No make-up lesson or billing adjustment is created automatically.</p>}
          {needsAck&&<label className="task-command-ack"><input type="checkbox" checked={ack} disabled={busy||attempted} onChange={e=>setAck(e.target.checked)}/>{duplicates.length?'This is a different person with the same name. Create a separate record.':'I have reviewed the selected record and the effect of this change.'}</label>}
          {unsafeRetry?<p>The save outcome could not be verified. Check the record in its normal screen before starting a new task. Do not repeat the action blindly.</p>:<Button disabled={busy||(needsAck&&!ack)} variant={plan.op==='delete'?'danger':'primary'} onClick={save}>{busy?'Saving…':attempted?'Check and retry save':'Confirm and save'}</Button>}
          <Button variant="ghost" disabled={busy||attempted} onClick={()=>setReviewing(false)}>Edit details</Button>
        </div>)}
        {output&&<><p>{output.length} records returned within your access. Counts describe these records, not measured academic mastery.</p>{output.slice(0,limit).map((row,i)=><Button variant="ghost" key={row.id||i} onClick={()=>setSelected({...row,__entity:plan.entity})}>{rowLabel(plan.entity,row)}{row.attendance?` · ${row.attendance}`:''}</Button>)}{output.length>limit&&<Button variant="ghost" onClick={()=>setLimit(n=>n+20)}>Show more records</Button>}</>}
        {onNavigate&&!(role==='tutor'&&['report','parent','tutor'].includes(plan.entity))&&<Button variant="ghost" disabled={busy} onClick={()=>{let route=routes[plan.entity];if(role==='tutor')route=({student:'mystudents',class:'myclasses'})[plan.entity]||route;onNavigate(route);}}>Open full {plan.entity==='report'?'report workspace':COMMAND_ENTITIES[plan.entity]?.plural.toLowerCase()}</Button>}
        <Button variant="ghost" disabled={busy} onClick={close}>Close task</Button>
      </div>}
      {selected&&<><RecordCard row={selected} entity={selectedEntity}/><Button variant="ghost" onClick={()=>setSelected(null)}>Close record details</Button></>}
    </div>
  </section>;
}
