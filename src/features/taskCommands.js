import {commandStaff} from './studentCommands.js';
import {qatarInput, qatarInstant} from '../services/booking.js';
import {createMessagingService} from '../services/messaging.js';
import {supabase} from '../supabaseClient.js';

const f=(key,label,type='text',required=false,extra={})=>({key,label,type,required,...extra});
const student=f('student_id','Student','student',true), tutor=f('tutor_id','Tutor','tutor',true);
const title=f('title','Title','text',true,{max:220}), name=f('full_name','Name','text',true,{max:150});
const time=f('scheduled_at','Date and time (Qatar)','datetime-local',true);
const duration=f('duration_min','Duration in minutes','number',true,{min:15,max:480,default:60});
const mode=f('mode','Class mode','select',true,{options:['Online','Offline'],default:'Online'});
const status=options=>f('status','Status','select',true,{options,default:options[0]});
const note=f('notes','Notes','textarea',false,{max:2000});
export const COMMAND_ENTITIES={
  student:{label:'Student',plural:'Students',read:'getStudents',create:'createStudent',update:'updateStudent',table:'students',staff:true,
    fields:[name,f('grade','Grade'),f('school','School'),f('curriculum','Curriculum'),f('subjects','Subjects (comma separated)','array'),f('parent_id','Parent (optional)','parent'),f('goals','Learning goals','textarea'),status(['Active','Inactive','Graduated'])]},
  parent:{label:'Parent',plural:'Parents',read:'getParents',create:'createParent',update:'updateParent',table:'parents',staff:true,
    fields:[name,f('email','Email','email'),f('phone','Phone','tel'),f('address','Address','textarea'),note,status(['Active','Inactive'])]},
  tutor:{label:'Tutor',plural:'Tutors',read:'getTutors',create:'createTutor',update:'updateTutor',table:'tutors',staff:true,
    fields:[name,f('email','Email','email'),f('phone','Phone','tel'),f('subjects','Subjects (comma separated)','array'),f('curriculum','Curricula (comma separated)','array'),f('bio','Biography','textarea'),status(['Active','Inactive','On Leave'])]},
  class:{label:'Class',plural:'Classes',read:'getClasses',create:'createClass',update:'updateClass',table:'classes',staff:true,
    fields:[student,tutor,f('subject','Subject','text',true),f('topic','Topic'),time,duration,mode,f('location','In-person address'),f('meeting_link','Meeting link','url'),status(['Scheduled','Completed','Cancelled','Rescheduled'])]},
  homework:{label:'Homework',plural:'Homework',read:'getHomework',create:'createHomework',update:'updateHomework',table:'homework',
    fields:[title,student,tutor,f('class_id','Linked class (optional)','class'),f('description','Instructions','textarea'),f('due_at','Due date and time (Qatar)','datetime-local'),status(['Assigned','Incomplete']),f('tutor_feedback','Tutor feedback','textarea')]},
  material:{label:'Material',plural:'Materials',read:'getMaterials',create:'createMaterial',update:'updateMaterial',table:'materials',
    fields:[title,tutor,f('student_id','Student (optional)','student'),f('subject','Subject'),f('description','Description','textarea'),f('file_url','Resource link','url',true),f('is_public','Share across your assigned students','checkbox',false,{default:false})]},
  note:{label:'Lesson note',plural:'Lesson notes',read:'getClassNotes',create:'createClassNote',update:'updateClassNote',table:'class_notes',
    fields:[student,tutor,f('class_id','Linked class','class',true),f('topic','Topic covered','text',true),f('understanding','Understanding','select',false,{options:['Excellent','Good','Fair','Needs Support']}),f('strengths','Strengths','textarea'),f('areas_to_improve','Areas to improve','textarea'),f('recommendation','Next steps','textarea'),f('summary','Summary','textarea'),f('is_shared_with_parent','Share with parent','checkbox',false,{default:false}),f('is_shared_with_student','Share with student','checkbox',false,{default:false})]},
  calendar:{label:'Calendar entry',plural:'Calendar entries',read:'getMasterCalendarEntries',
    fields:[title,f('category','Category','select',true,{options:['Task','Other','Exam','QatarHoliday'],default:'Task'}),f('visibility','Visible to','select',true,{options:['private','shared'],default:'private'}),f('starts_on','Date','date',true),f('ends_on','End date (inclusive)','date',true),f('all_day','All-day entry','checkbox',false,{default:true}),f('starts_at','Timed start (Qatar, for timed entries)','datetime-local'),f('duration_min','Timed duration in minutes','number',false,{min:1,max:1440,default:60}),note,f('task_status','Task status','select',true,{options:['Open','Done'],default:'Open'})]},
  exam:{label:'Student exam',plural:'Student exams',read:'getStudentExams',fields:[student,{...title,max:160},time,duration,note]},
  availability:{label:'Availability window',plural:'Availability windows',read:'getTutorAvailability',fields:[tutor,f('starts_at','Available from (Qatar)','datetime-local',true),f('ends_at','Available until (Qatar)','datetime-local',true),f('mode','Teaching mode','select',true,{options:['Online','Offline','Either'],default:'Either'}),f('buffer_min','Travel buffer in minutes','number',true,{min:0,max:180,default:30})]},
  request:{label:'Booking request',plural:'Booking requests',read:'getBookingRequests'},
  enquiry:{label:'Assessment enquiry',plural:'Assessment enquiries',read:'getAssessmentRequests',update:'updateAssessmentRequest',staff:true,fields:[status(['New','Contacted','Converted','Closed']),f('admin_notes','Internal notes','textarea')]},
  assignment:{label:'Tutor assignment',plural:'Tutor assignments',read:'getStudentTutors',staff:true,fields:[student,tutor,f('subjects','Subjects (comma separated)','array')]},
};
const aliases={assignment:'assignment',assignments:'assignment','tutor assignments':'assignment',students:'student',parents:'parent',tutors:'tutor',classes:'class',lesson:'class',lessons:'class',materials:'material',resource:'material',resources:'material',notes:'note','lesson note':'note',calendar:'calendar',event:'calendar',events:'calendar',task:'calendar',tasks:'calendar',exams:'exam','student exam':'exam',requests:'request','booking request':'request','booking requests':'request',enquiries:'enquiry',enquiry:'enquiry',assessments:'enquiry','assessment request':'enquiry',availability:'availability',homework:'homework',student:'student',parent:'parent',tutor:'tutor',class:'class',material:'material',note:'note',exam:'exam',request:'request'};
const verbs={add:'create',create:'create',schedule:'create',assign:'create',find:'list',show:'list',list:'list',check:'list',checking:'list',view:'list',edit:'update',update:'update',change:'update',move:'update',reschedule:'update',delete:'delete',remove:'delete',cancel:'cancel',complete:'complete',confirm:'confirm',decline:'decline',propose:'propose',review:'review',close:'close',done:'done'};
const reports={attendance:'getAttendanceReport',progress:'getProgressReport',homework:'getHomeworkReport',revenue:'getRevenueReport',outstanding:'getOutstandingPaymentsReport',performance:'getTutorPerformanceReport'};
export const REPORT_TYPES=Object.keys(reports);
export function permittedCommand(plan,role) {
  if(!commandStaff(role)&&role!=='tutor')return false;
  if(plan.entity==='report')return commandStaff(role)||!['revenue','outstanding','performance'].includes(plan.report);
  const def=COMMAND_ENTITIES[plan.entity];if(!def)return false;
  if(plan.op==='list')return !['enquiry'].includes(plan.entity)||commandStaff(role);
  if(['student','parent','tutor','enquiry','assignment'].includes(plan.entity)||plan.op==='linkParent')return commandStaff(role);
  if(plan.entity==='class')return commandStaff(role)||['attendance','cancel','complete'].includes(plan.op);
  return true;
}
export const commandLabel=p=>p.op==='linkParent'?'Link parent to student':p.op==='unlink'?'Revoke tutor assignment':p.entity==='report'?`${p.report[0].toUpperCase()+p.report.slice(1)} report`:`${({create:'Add',list:'Find',update:'Edit',delete:'Remove',attendance:'Mark attendance',confirm:'Confirm',decline:'Decline',propose:'Propose changes to',review:'Review',cancel:'Cancel',complete:'Complete',close:'Close',done:'Complete task'})[p.op]||p.op} ${COMMAND_ENTITIES[p.entity]?.label.toLowerCase()}`;
export function commandExamples(role) {
  const all=['Add student Naila, Year 8, maths','Add parent Fatima','Add class for Naila','Add homework Fractions for Naila','Mark Naila present today','Add material Fractions worksheet','Show requests','Attendance report','Add calendar event Parent meeting tomorrow','Delete calendar event Parent meeting','Add note for Naila','Add exam for Naila','Add availability','Review homework Fractions','Confirm request for Naila','Edit student Naila','Show calendar','Show materials','Progress report','Show homework','Show classes','Add tutor Amal','Check enquiries','Link parent Fatima to Naila','Assign tutor Amal to Naila','Unlink tutor Amal from Naila','Show assignments','Homework report','Revenue report','Outstanding report','Performance report','Edit homework Fractions','Delete homework Fractions','Edit material Worksheet','Delete material Worksheet','Cancel class for Naila','Complete class for Naila','Decline request for Naila','Propose request for Naila','Close availability','Complete task Parent meeting'];
  all.unshift('Message Sara Whitfield: Please confirm tomorrow’s lesson','Reply to Sara Whitfield: Thanks for the update');
  return all.filter(text=>{try{return permittedCommand(parseTaskCommand(text),role);}catch{return false;}});
}
function localDate(word,now) {
  const today=qatarInput(now).slice(0,10);
  if(/^today$/i.test(word))return today;
  if(/^tomorrow$/i.test(word))return new Date(Date.parse(today+'T00:00:00Z')+86400000).toISOString().slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(word)||new Date(word+'T00:00:00Z').toISOString().slice(0,10)!==word)throw Error('Use a real date in YYYY-MM-DD format, today or tomorrow.');
  return word;
}
export function parseTaskCommand(input,now=new Date()) {
  let text=input.trim().replace(/^(?:please\s+)/i,'').replace(/^(?:marking|makring|makr)\b/i,'mark').replace(/^checking\b/i,'check').replace(/^adding\b/i,'add').replace(/^deleting\b/i,'delete').replace(/^creating\b/i,'create');
  if(!text||text.length>1500)throw Error('Enter a task of 1–1500 characters.');
  if(/\b(?:and|then)\s+(?:add|create|delete|remove|send|book|move|invite|assign|mark)\b|[;\n]/i.test(text))throw Error('Please enter one task at a time.');
  const parts=text.split(',').map(s=>s.trim());let head=parts.shift();
  const reportMatch=/^(?:(?:show|check|view|run|generate)\s+)?(?:(attendance|progress|homework|revenue|outstanding|performance)\s+)?reports?(?:\s+(attendance|progress|homework|revenue|outstanding|performance))?(?:\s+for\s+(.+))?$/i.exec(head);
  let plan;
  const linking=/^(link|assign|unlink)\s+(parent|tutor)\s+(.+?)\s+(?:to|from)\s+(?:student\s+)?(.+)$/i.exec(head);
  if(linking){if(linking[2].toLowerCase()==='parent'&&linking[1].toLowerCase()==='unlink')throw Error('Link the student to the correct parent instead; removing a family link can create a placeholder.');plan={entity:linking[2].toLowerCase()==='parent'?'student':'assignment',op:linking[2].toLowerCase()==='parent'?'linkParent':linking[1].toLowerCase()==='unlink'?'unlink':'create',fields:{},query:linking[2].toLowerCase()==='parent'?linking[4]:'',studentName:linking[4],[`${linking[2].toLowerCase()}Name`]:linking[3]};}
  if(!plan&&reportMatch)plan={entity:'report',op:'list',report:(reportMatch[1]||reportMatch[2]||'attendance').toLowerCase(),fields:{},query:'',studentName:reportMatch[3]||''};
  else if(!plan) {
    const attendanceTask=/^mark\s+attendance(?:\s+for\s+(.+))?$/i.exec(head);
    const att=/^(?:add|create|find|show|list|check|view|edit|update|change|move|delete|remove|cancel|complete|confirm|decline|propose|review|close)\s/i.test(head)?null:/^(?:mark\s+)?(?:attendance\s+(?:for\s+)?)?(.+?)\s+(present|absent|pending|cancelled)(?:\s+(today|tomorrow|\d{4}-\d{2}-\d{2}))?$/i.exec(head);
    if(attendanceTask)plan={entity:'class',op:'attendance',fields:{},query:'',studentName:attendanceTask[1]||''};
    else if(att)plan={entity:'class',op:'attendance',fields:{attendance:att[2][0].toUpperCase()+att[2].slice(1).toLowerCase()},query:'',studentName:att[1].replace(/^mark\s+/i,''),day:att[3]?localDate(att[3],now):''};
    else {
      const m=/^(add|create|schedule|assign|find|show|list|check|view|edit|update|change|move|reschedule|delete|remove|cancel|complete|confirm|decline|propose|review|close|done)\s+(.+)$/i.exec(head);
      if(!m)throw Error('Choose an example below, such as “Add homework for Naila”, “Mark Naila present today”, or “Show requests”.');
      let rest=m[2].trim().replace(/^the\s+/i,'');if(/^(?:schedule|schedules)\b/i.test(rest)&&['confirm','decline','propose'].includes(m[1].toLowerCase()))rest=rest.replace(/^schedules?\b/i,'request');const statusMatch=/^(pending|proposed|confirmed|submitted|reviewed|overdue)\s+/i.exec(rest);if(statusMatch)rest=rest.slice(statusMatch[0].length);
      const entityKey=Object.keys(aliases).sort((a,b)=>b.length-a.length).find(k=>rest.toLowerCase()===k||rest.toLowerCase().startsWith(k+' '));
      if(!entityKey)throw Error('Which record? Use student, parent, tutor, class, homework, material, note, calendar event, exam, availability, request or enquiry.');
      const entity=aliases[entityKey];rest=rest.slice(entityKey.length).trim();if(entity==='calendar')rest=rest.replace(/^(?:event|entry|task)\s*/i,'');
      plan={entity,op:verbs[m[1].toLowerCase()],fields:{},query:'',studentName:''};
      if(entity==='class'&&plan.op==='update')rest=rest.replace(/^(?:timing|time)\b\s*/i,'');
      if(statusMatch){if(plan.op!=='list')throw Error('Status prefixes are supported for lookups only.');plan.statusFilter=statusMatch[1][0].toUpperCase()+statusMatch[1].slice(1).toLowerCase();}
      if(entity==='calendar'&&plan.op==='complete')plan.op='done';
      const forStudent=/\s*\bfor\s+(.+)$/i.exec(rest);
      if(forStudent&&['class','homework','note','exam','request','material'].includes(entity)){plan.studentName=forStudent[1].trim();rest=rest.slice(0,forStudent.index).trim();}
      const dateMatch=/\s+(today|tomorrow|\d{4}-\d{2}-\d{2})(?:\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?$/i.exec(plan.studentName||rest);
      if(dateMatch){plan.day=localDate(dateMatch[1],now);if(plan.studentName)plan.studentName=plan.studentName.slice(0,dateMatch.index).trim();else rest=rest.slice(0,dateMatch.index).trim();if(plan.op==='create'){
        if(entity==='calendar'){plan.fields.starts_on=plan.day;plan.fields.ends_on=plan.day;}
        else if(dateMatch[2]){let [h,min='00']=dateMatch[2].replace(/\s/g,'').replace(/am|pm/i,'').split(':');h=Number(h);const meridian=dateMatch[2].match(/am|pm/i)?.[0]?.toLowerCase();if(meridian){if(h<1||h>12)throw Error('Use a valid 12-hour time.');h=h%12+(meridian==='pm'?12:0);}if(h>23||Number(min)>59)throw Error('Use a valid time.');if(!meridian&&h>=1&&h<=12)throw Error('Specify AM or PM, or use a time such as 17:00.');plan.fields.scheduled_at=`${plan.day}T${String(h).padStart(2,'0')}:${min}`;}
      }}
      if(plan.op==='create'&&rest){const key=['student','parent','tutor'].includes(entity)?'full_name':['class'].includes(entity)?'subject':entity==='note'?'topic':'title';plan.fields[key]=rest;}
      else plan.query=rest;
    }
  }
  const def=COMMAND_ENTITIES[plan.entity];
  const supported={student:['create','list','update','delete','linkParent'],assignment:['create','unlink','list'],class:['create','list','update','delete','attendance','cancel','complete'],homework:['create','list','update','delete','review'],request:['list','confirm','decline','propose'],availability:['create','list','close'],calendar:['create','list','update','delete','done'],exam:['create','list','update','delete'],enquiry:['list','update']};
  if(plan.entity!=='report'&&!(supported[plan.entity]||['create','list','update','delete']).includes(plan.op))throw Error('That action is unavailable for this record. Choose a supported task from the examples.');
  const keyAliases={name:'full_name',grade:'grade',school:'school',curriculum:'curriculum',subject:['student','tutor','assignment'].includes(plan.entity)?'subjects':'subject',subjects:'subjects',title:'title',student:'studentName',tutor:'tutorName',parent:'parentName',date:'date',time:'time',duration:'duration_min',due:'due_at',phone:'phone',email:'email',address:'address',location:'location',link:plan.entity==='class'?'meeting_link':'file_url',description:'description',instructions:'description',notes:'notes',topic:'topic',summary:'summary',understanding:'understanding',feedback:'tutor_feedback',status:'status',mode:'mode',visibility:'visibility',category:'category',start:'starts_at',end:'ends_at',buffer:'buffer_min',reason:'response_note',response:'response_note',from:'from',to:'to'};
  for(const part of parts){
    if(!part)continue;
    if(/^(year|grade)\s+\d{1,2}$/i.test(part)&&plan.entity==='student'){plan.fields.grade=part;continue;}
    if(/^(maths|mathematics|english|physics|chemistry|biology|economics|history|geography)$/i.test(part)&&['student','tutor'].includes(plan.entity)){plan.fields.subjects=part;continue;}
    const m=/^([\w ]+):\s*(.*)$/.exec(part);if(!m)throw Error(`Use a labelled detail for “${part}”, such as due: tomorrow or subject: Maths.`);
    const key=keyAliases[m[1].trim().toLowerCase()];if(!key)throw Error(`Unknown detail “${m[1]}”. Use the task's editable fields instead.`);
    if(['studentName','tutorName','parentName'].includes(key)){plan[key]=m[2];continue;}
    if(key==='date'){plan.day=localDate(m[2],now);if(plan.entity==='calendar'){plan.fields.starts_on=plan.day;plan.fields.ends_on=plan.day;}continue;}
    if(key==='time'){if(!/^\d{2}:\d{2}$/.test(m[2]))throw Error('Use a 24-hour time such as 17:00.');plan.time=m[2];continue;}
    const extras=plan.entity==='report'?['from','to']:plan.entity==='request'?['response_note']:plan.entity==='homework'?['tutor_feedback']:[];
    if(!def?.fields?.some(f=>f.key===key)&&!extras.includes(key))throw Error(`“${m[1]}” is not a field for this task.`);
    let value=m[2];if(['due_at','from','to'].includes(key)&&/^(today|tomorrow|\d{4}-\d{2}-\d{2})$/i.test(value))value=localDate(value,now)+(key==='due_at'?'T18:00':'');
    plan.fields[key]=value;
  }
  if(plan.time){if(!plan.day)throw Error('Include a date with the time.');plan.fields.scheduled_at=`${plan.day}T${plan.time}`;}
  return plan;
}

export function fieldsFor(plan) {
  if(plan.entity==='message')return [f('body','Message','textarea',true,{max:4000})];
  if(plan.entity==='report')return [f('from','From date (optional)','date'),f('to','Through date (optional)','date'),f('student_id','Student (optional)','student')].filter(x=>!(plan.report==='outstanding')&&(!['revenue','performance'].includes(plan.report)||x.key!=='student_id'));
  if(plan.op==='list')return [];
  if(plan.op==='linkParent')return [f('parent_id','Parent','parent',true)];
  if(plan.op==='unlink')return [];
  if(plan.op==='attendance')return [f('attendance','Attendance','select',true,{options:['Present','Absent','Pending','Cancelled']})];
  if(['cancel','complete','delete','close','done','confirm'].includes(plan.op))return [];
  if(plan.op==='decline')return [f('response_note','Reason / response','textarea',true)];
  if(plan.op==='review')return [f('tutor_feedback','Feedback','textarea',true)];
  if(plan.op==='propose')return [time,duration,mode,f('location','In-person address'),f('response_note','Response','textarea')];
  const fields=COMMAND_ENTITIES[plan.entity]?.fields||[];
  return plan.entity==='homework'&&plan.op==='update'?fields.map(field=>field.key==='status'?{...field,options:['Assigned','Submitted','Reviewed','Incomplete']}:field):fields;
}
export function rowLabel(entity,row) {
  const when=row.scheduled_at||row.starts_at||row.due_at;
  return [row.full_name||row.title||row.topic||row.student_name||row.student?.full_name||row.parent_name||row.subject||row.tutor?.full_name||'Record',row.student?.full_name&&row.title?row.student.full_name:'',row.subject&&row.student?.full_name?row.subject:'',row.grade||'',row.school||'',when?qatarInput(when).replace('T',' ')+' Qatar':row.starts_on||'',row.status||row.attendance||''].filter(Boolean).join(' · ');
}
export function filterCommandRows(plan,rows) {
  return rows.filter(r=>!r.deleted_at&&(plan.entity!=='availability'||r.published!==false)).filter(r=>{
    const text=[r.full_name,r.title,r.topic,r.student_name,r.subject,r.student?.full_name,r.parent_name,r.tutor?.full_name].filter(Boolean).join(' ').toLowerCase();
    return (!plan.statusFilter||r.status===plan.statusFilter)&&(!plan.query||text.includes(plan.query.toLowerCase()))&&(!plan.studentName||[r.full_name,r.student_name,r.student?.full_name].filter(Boolean).some(n=>n.toLowerCase().includes(plan.studentName.toLowerCase())))&&(!plan.tutorName||plan.entity!=='assignment'||r.tutor?.full_name?.toLowerCase().includes(plan.tutorName.toLowerCase()))&&(!plan.day||!(r.scheduled_at||r.starts_on)||String(r.scheduled_at?qatarInput(r.scheduled_at):r.starts_on).slice(0,10)===plan.day);
  });
}
export async function commandRead(service,entity,context) {
  const def=COMMAND_ENTITIES[entity];if(!def)throw Error('Unknown record type.');
  let result;
  if(entity==='student'&&context.role==='tutor'){if(!context.tutorId)throw Error('Your tutor profile is not linked yet.');result=await service.getStudentsByTutor(context.tutorId);}
  else result=await service[def.read](['class','homework','material','note'].includes(entity)&&context.role==='tutor'?{tutorId:context.tutorId}:{});
  if(result.error)throw Error(result.error.message);
  return (result.data||[]).filter(r=>!r.deleted_at&&(context.role!=='tutor'||!r.tutor_id||r.tutor_id===context.tutorId));
}
export async function prepareTask(plan,service,context) {
  if(plan.entity==='message'){
    if(!context.userId)throw Error('Sign in again to send a message.');
    const messaging=createMessagingService(supabase);
    const [c,i]=await Promise.all([messaging.contacts(),messaging.inbox()]);
    if(c.error||i.error)throw Error('Unable to look up messaging contacts. Open Inbox to retry.');
    const matches=(c.data||[]).filter(x=>x.full_name.toLowerCase().includes(plan.query.toLowerCase()));
    if(matches.length!==1)throw Error(matches.length?'More than one user matches. Use their full name.':'No active user matches that name.');
    const person=matches[0],thread=(i.data||[]).find(x=>x.peer_id===person.id);
    if(plan.op==='reply'&&!thread)throw Error('No existing conversation with '+person.full_name+'. Start with Message '+person.full_name+': …');
    return {...plan,target:person,refs:{target:c.data||[]},values:{...plan.fields,recipient_id:person.id}};
  }
  const draft=context.role==='tutor'&&plan.op==='create'&&['student','parent','tutor','class'].includes(plan.entity);
  if(!permittedCommand(plan,context.role)&&!draft)throw Error('Your role cannot perform this action. Ask an authorized staff member; nothing has been changed.');
  if(context.role==='tutor'&&!context.tutorId)throw Error('Your tutor profile is not linked yet.');
  const refs={},needed=new Set(fieldsFor(plan).filter(f=>['student','parent','tutor','class'].includes(f.type)).map(f=>f.type));
  const requests=[...needed].map(async entity=>{refs[entity]=await commandRead(service,entity,context);});
  if(plan.entity!=='report')requests.push((async()=>{refs.target=await commandRead(service,plan.entity,context);})());
  const results=await Promise.allSettled(requests);const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
  const values=Object.fromEntries(fieldsFor(plan).map(f=>[f.key,f.default??(f.type==='checkbox'?false:'')]));
  Object.assign(values,plan.fields);
  for(const type of ['student','tutor','parent']){const hint=plan[`${type}Name`];if(hint&&refs[type]){const exact=refs[type].filter(r=>r.full_name.toLowerCase()===hint.toLowerCase()),partial=refs[type].filter(r=>r.full_name.toLowerCase().includes(hint.toLowerCase()));const matches=exact.length?exact:partial;if(matches.length===1)values[`${type}_id`]=matches[0].id;}}
  if(context.role==='tutor'&&needed.has('tutor'))values.tutor_id=context.tutorId;
  else if(needed.has('tutor')&&!values.tutor_id&&!plan.tutorName&&refs.tutor?.length===1)values.tutor_id=refs.tutor[0].id;
  if(values.starts_on&&!values.ends_on)values.ends_on=values.starts_on;
  if(plan.entity==='report'&&plan.studentName&&!values.student_id)throw Error('The student name is missing or ambiguous. Use the exact full name for this report.');
  return {...plan,id:crypto.randomUUID(),refs,values,selection:'',target:null,draft};
}
export function selectTaskTarget(plan,id) {
  const row=plan.refs.target.find(r=>r.id===id);if(!row)throw Error('Select an available record.');
  const values={...plan.values};
  for(const field of fieldsFor(plan)){
    let value=row[field.key];if(value===undefined||value===null)continue;
    if(field.type==='datetime-local')value=qatarInput(value);
    if(field.type==='array')value=value.join(', ');
    values[field.key]=value;
  }
  // Explicit command details take precedence over stored values.
  Object.assign(values,plan.fields);
  for(const type of ['parent','tutor'])if(plan[`${type}Name`])values[`${type}_id`]=plan.values[`${type}_id`]||'';
  return {...plan,selection:id,target:{...row},values};
}
export function changeTaskValue(plan,key,value) {
  const values={...plan.values,[key]:value};
  if(key==='class_id'&&value){const lesson=plan.refs.class?.find(row=>row.id===value);if(lesson){values.student_id=lesson.student_id;values.tutor_id=lesson.tutor_id;if(plan.entity==='note'&&!values.topic)values.topic=lesson.topic||lesson.subject||'';}}
  if(key==='student_id'){
    const selected=plan.refs.student?.find(row=>row.id===value);
    if(selected?.subjects?.length===1&&'subject' in values&&!values.subject)values.subject=selected.subjects[0];
    if(values.class_id&&!plan.refs.class?.some(row=>row.id===values.class_id&&row.student_id===value))values.class_id='';
  }
  if(key==='starts_on'&&(!values.ends_on||values.ends_on<value))values.ends_on=value;
  return {...plan,values};
}
export function validateTask(plan,context) {
  if(!permittedCommand(plan,context.role))throw Error('Your role cannot perform this action.');
  if(plan.op!=='create'&&plan.op!=='list'&&!plan.target)throw Error('Choose the exact record first.');
  for(const field of fieldsFor(plan)){
    if(plan.entity==='calendar'&&(['starts_at','duration_min'].includes(field.key)&&plan.values.all_day||['starts_on','ends_on'].includes(field.key)&&!plan.values.all_day))continue;
    const value=plan.values[field.key];
    if(field.required&&(value===undefined||value===null||String(value).trim()===''))throw Error(`${field.label} is required.`);
    if(value===''||value===null||value===undefined)continue;
    if(field.max&&field.type!=='number'&&String(value).length>field.max)throw Error(`${field.label} is too long.`);
    if(field.type==='number'&&(!Number.isInteger(Number(value))||Number(value)<field.min||Number(value)>field.max))throw Error(`${field.label} must be between ${field.min} and ${field.max}.`);
    if(field.type==='select'&&!field.options.includes(value))throw Error(`Choose a valid ${field.label.toLowerCase()}.`);
    if(field.type==='url'){let url;try{url=new URL(value);}catch{throw Error(`Enter a valid ${field.label.toLowerCase()}.`);}if(url.protocol!=='https:')throw Error('Links must start with https://.');}
    if(field.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Error('Enter a valid email address.');
    if(field.type==='date')localDate(value,new Date());
    if(field.type==='datetime-local'){
      if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error(`Enter a valid ${field.label.toLowerCase()}.`);
      localDate(value.slice(0,10),new Date());if(qatarInput(qatarInstant(value))!==value)throw Error('Enter a valid Qatar date and time.');
    }
    if(['student','tutor','parent','class'].includes(field.type)&&!plan.refs[field.type]?.some(r=>r.id===value))throw Error(`Select an accessible ${field.type}.`);
  }
  const v=plan.values;
  if(context.role==='tutor'&&['class','homework','material','note','availability','request'].includes(plan.entity)&&plan.target?.tutor_id&&plan.target.tutor_id!==context.tutorId)throw Error('This record is outside your assigned work.');
  if(context.role==='tutor'&&v.tutor_id&&v.tutor_id!==context.tutorId)throw Error('Choose your own tutor profile.');
  if(v.mode==='Offline'&&['class','request'].includes(plan.entity)&&!v.location?.trim())throw Error('An in-person address is required.');
  if(plan.entity==='calendar'&&plan.op!=='delete'&&plan.op!=='done'&&plan.op!=='list'&&v.ends_on<v.starts_on)throw Error('End date must be on or after the start date.');
  if(plan.entity==='calendar'&&['create','update'].includes(plan.op)&&!v.all_day&&(!v.starts_at||!v.duration_min))throw Error('Timed calendar entries need a start time and duration.');
  if(plan.entity==='calendar'&&plan.op==='done'&&plan.target?.category!=='Task')throw Error('Only calendar tasks can be marked done.');
  if(plan.entity==='availability'&&plan.op==='create'&&(v.ends_at<=v.starts_at||Date.parse(qatarInstant(v.ends_at))-Date.parse(qatarInstant(v.starts_at))>86400000))throw Error('Availability must end after it starts and fit within 24 hours.');
  if(plan.entity==='report'&&v.from&&v.to&&v.from>v.to)throw Error('Report end date must follow its start date.');
  if(plan.entity==='material'&&v.is_public&&v.student_id)throw Error('Choose a student or sharing across assigned students, rather than both.');
  const linked=v.class_id&&plan.refs.class?.find(r=>r.id===v.class_id);
  if(linked&&(linked.student_id!==v.student_id||linked.tutor_id!==v.tutor_id))throw Error('The linked class must match the selected student and tutor.');
}
export function taskPayload(plan) {
  const values={};
  for(const f of fieldsFor(plan)){
    let v=plan.values[f.key];
    if(f.type==='checkbox')v=!!v;
    else if(f.type==='array')v=String(v||'').split(',').map(s=>s.trim()).filter(Boolean);
    else if(f.type==='number')v=Number(v);
    else if(f.type==='datetime-local')v=v?qatarInstant(v):null;
    else if(['student','tutor','parent','class'].includes(f.type))v=v||null;
    else v=typeof v==='string'?v.trim():v;
    if(v===''&&f.key==='understanding')continue;
    values[f.key]=v;
  }
  return values;
}
export async function runTask(plan,service,context) {
  validateTask(plan,context);
  if(plan.entity==='message'){
    const {data,error}=await createMessagingService(supabase).send(context.userId,plan.values.recipient_id,plan.values.body,crypto.randomUUID());
    if(error)throw Error('Message could not be sent. Open Inbox to check the conversation.');
    return {record:data};
  }
  if(plan.entity==='report'){
    const params={...(context.role==='tutor'?{tutorId:context.tutorId}:{}),...(plan.values.student_id?{studentId:plan.values.student_id}:{}),...(plan.values.from?{from:qatarInstant(plan.values.from+'T00:00')}:{}),...(plan.values.to?{to:qatarInstant(plan.values.to+'T23:59')}: {})};
    const r=await service[reports[plan.report]](params);if(r.error)throw Error(r.error.message);
    const rows=(r.data||[]).filter(x=>!x.deleted_at&&(!plan.values.student_id||x.student?.id===plan.values.student_id)).filter(x=>{const day=qatarInput(x.scheduled_at||x.due_at||x.paid_at||x.created_at).slice(0,10);return (!plan.values.from||day>=plan.values.from)&&(!plan.values.to||day<=plan.values.to);});
    return {rows,read:true};
  }
  if(plan.op==='list'){
    if(plan.entity==='calendar'){
      const entities=['calendar','class','exam','request','homework'];const values=await Promise.all(entities.map(e=>commandRead(service,e,context)));
      const {masterCalendarEntries}=await import('../services/masterCalendar.js');
      return {rows:filterCommandRows(plan,masterCalendarEntries(Object.fromEntries(['entries','classes','exams','requests','homework'].map((key,i)=>[key,values[i]])))),read:true};
    }
    return {rows:filterCommandRows(plan,await commandRead(service,plan.entity,context)),read:true};
  }
  const def=COMMAND_ENTITIES[plan.entity];let target=plan.target;
  const fresh=await commandRead(service,plan.entity,context);
  if(plan.op==='create'){
    const recovered=fresh.find(r=>r.id===plan.id);if(recovered)return {record:recovered};
  }else{
    const row=fresh.find(r=>r.id===target.id);if(!row)throw Error('This record is no longer available. Start a fresh task.');
    const changed=Object.keys(target).some(k=>(target[k]===null||typeof target[k]!=='object')&&target[k]!==row[k]);
    if(changed)throw Error('This record changed after your preview. Start a fresh task to review the latest details.');
    target=row;
  }
  const payload=taskPayload(plan);let result;
  if(plan.entity==='calendar'){
    const base=target||{};
    if(['create','update'].includes(plan.op)){
      if(payload.all_day){payload.starts_at=null;payload.duration_min=null;}
      else {payload.starts_on=qatarInput(payload.starts_at).slice(0,10);payload.ends_on=qatarInput(new Date(Date.parse(payload.starts_at)+payload.duration_min*60000-1)).slice(0,10);}
    }
    if(plan.op==='create')result=await service.saveMasterCalendarEntry({...payload,verification:'Tutor entered'});
    else if(plan.op==='delete')result=await service.saveMasterCalendarEntry({deleted_at:new Date().toISOString()},{...base,origin:'calendar'});
    else if(plan.op==='done')result=await service.saveMasterCalendarEntry({task_status:'Done'},{...base,origin:'calendar'});
    else result=await service.saveMasterCalendarEntry(payload,{...base,origin:'calendar'});
  }else if(plan.entity==='exam'){
    if(plan.op==='delete')result=await service.removeStudentExam(target.id);
    else {if(target)delete payload.student_id;result=await service.saveStudentExam(payload,target?.id||null);}
  }else if(plan.entity==='availability')result=plan.op==='close'?await service.closeAvailability(target.id):await service.publishAvailability(payload);
  else if(plan.entity==='request'){
    if(!['Pending','Proposed'].includes(target.status)||plan.op==='confirm'&&target.status!=='Pending')throw Error('This request is no longer awaiting that response.');
    const changes=plan.op==='propose'?{scheduled_at:payload.scheduled_at,duration_min:payload.duration_min,mode:payload.mode,location:payload.location||'',recurrence:target.recurrence||{frequency:'once',weekdays:[],count:1}}:{};
    result=await service.reviewBookingRequest(target,plan.op,changes,payload.response_note||'');
  }else if(plan.entity==='assignment'){
    if(plan.op==='unlink')result=await service.removeStudentTutor(target.id);
    else {const existing=fresh.find(row=>row.student_id===payload.student_id&&row.tutor_id===payload.tutor_id);if(existing&&existing.is_active!==false)return {record:existing};if(existing)throw Error('This assignment already exists but is inactive. Reactivate it from the student assignment screen.');result=await service.assignTutorToStudent(payload.student_id,payload.tutor_id,payload.subjects);}
  }else if(plan.op==='linkParent')result=await service.updateStudent(target.id,{parent_id:payload.parent_id});
  else if(plan.op==='delete')result=await service.softDeleteRecord(def.table,target.id);
  else if(plan.op==='attendance')result=await service.markAttendance(target.id,payload.attendance);
  else if(plan.op==='cancel'||plan.op==='complete')result=await service.updateClassStatus(target.id,plan.op==='cancel'?'Cancelled':'Completed');
  else if(plan.op==='review'){
    if(target.status!=='Submitted')throw Error('Only submitted homework can be marked as reviewed.');
    result=await service.reviewHomework(target.id,payload.tutor_feedback);
  }else if(plan.op==='create')result=await service[def.create]({...payload,id:plan.id});
  else result=await service[def.update](target.id,payload);
  if(result.error)throw Error(result.error.message);
  if(!result.data&&!(plan.entity==='exam'&&plan.op==='delete'))throw Error('No saved record was returned. Refresh to verify the outcome before starting another task.');
  return {record:result.data||target};
}
