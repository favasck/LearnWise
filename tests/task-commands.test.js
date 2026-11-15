import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseTaskCommand,prepareTask,selectTaskTarget,changeTaskValue,validateTask,runTask,commandExamples,permittedCommand,COMMAND_ENTITIES,filterCommandRows} from '../src/features/taskCommands.js';

const context={role:'admin_tutor',userId:'actor',tutorId:'t'};
const now=new Date('2026-11-15T22:00:00Z'); // 16 November in Qatar
const ok=data=>({data,error:null});
function fixture(){
  const data={student:[{id:'s',full_name:'Naila',grade:'Year 8',updated_at:'v1'}],parent:[{id:'p',full_name:'Fatima',updated_at:'v1'}],tutor:[{id:'t',full_name:'Amal',updated_at:'v1'}],class:[{id:'c',student_id:'s',tutor_id:'t',subject:'Maths',scheduled_at:'2026-11-16T14:00:00Z',duration_min:60,mode:'Online',status:'Scheduled',attendance:'Pending',updated_at:'v1',student:{id:'s',full_name:'Naila'}}],homework:[{id:'h',title:'Fractions',student_id:'s',tutor_id:'t',status:'Submitted',updated_at:'v1',student:{id:'s',full_name:'Naila'}}],material:[{id:'m',title:'Worksheet',student_id:'s',tutor_id:'t',file_url:'https://example.test/worksheet',updated_at:'v1'}],note:[],calendar:[{id:'e',title:'Meeting',category:'Task',visibility:'shared',starts_on:'2026-11-16',ends_on:'2026-11-16',version:2}],exam:[{id:'x',title:'Maths exam',student_id:'s',scheduled_at:'2026-11-17T06:00:00Z',duration_min:60}],availability:[{id:'a',tutor_id:'t',starts_at:'2026-11-17T06:00:00Z',ends_at:'2026-11-17T08:00:00Z',published:true}],request:[{id:'r',student_id:'s',tutor_id:'t',student_name:'Naila',status:'Pending',version:3,scheduled_at:'2026-11-17T06:00:00Z',duration_min:60,mode:'Online',recurrence:{frequency:'weekly',weekdays:[2],count:4}}],enquiry:[{id:'q',student_name:'Naila',parent_name:'Fatima',status:'New'}]};
  const calls=[],service={};
  for(const [entity,def] of Object.entries(COMMAND_ENTITIES)){
    service[def.read]=async()=>ok(data[entity]);
    if(def.create)service[def.create]=async values=>{calls.push([def.create,values]);const row={...values};data[entity].push(row);return ok(row);};
    if(def.update)service[def.update]=async(id,values)=>{calls.push([def.update,id,values]);return ok({id,...values});};
  }
  service.getStudentsByTutor=service.getStudents;
  for(const method of ['markAttendance','updateClassStatus','reviewHomework','softDeleteRecord','saveMasterCalendarEntry','saveStudentExam','removeStudentExam','publishAvailability','closeAvailability','reviewBookingRequest'])service[method]=async(...args)=>{calls.push([method,...args]);return ok({id:args[0]?.id||'saved',...args[0]});};
  for(const method of ['getAttendanceReport','getProgressReport','getHomeworkReport','getRevenueReport','getOutstandingPaymentsReport','getTutorPerformanceReport'])service[method]=async args=>{calls.push([method,args]);return ok([]);};
  return {data,calls,service};
}
test('natural task examples cover each requested domain and Qatar date boundaries',()=>{
  for(const example of commandExamples('admin_tutor'))assert.doesNotThrow(()=>parseTaskCommand(example,now),example);
  assert.equal(parseTaskCommand('Mark Naila present today',now).day,'2026-11-16');
  assert.equal(parseTaskCommand('Add class for Naila tomorrow at 5 PM',now).fields.scheduled_at,'2026-11-17T17:00');
  assert.equal(parseTaskCommand('Show pending requests',now).statusFilter,'Pending');
  assert.equal(parseTaskCommand('Complete task Meeting',now).op,'done');
  assert.equal(parseTaskCommand('Progress report for Naila',now).studentName,'Naila');
  assert.equal(parseTaskCommand('Mark attendance',now).op,'attendance');
  for(const bad of ['Delete everything','Add student Naila and delete class','Add class for Naila tomorrow at 5','Add calendar Meeting, date: 2026-02-30','Add parent Fatima, ownership: someone','Add parent Fatima, from: today','Add homework Fractions; remove student Naila'])assert.throws(()=>parseTaskCommand(bad,now),bad);
});
test('role checks apply to commands and execution, with unsaved tutor drafts',async()=>{
  const {service}=fixture();
  const tutor={...context,role:'tutor'};
  for(const text of ['Delete student Naila','Delete class Maths','Revenue report','Edit parent Fatima']){
    const parsed=parseTaskCommand(text);assert.equal(permittedCommand(parsed,'tutor'),false);
    await assert.rejects(()=>prepareTask(parsed,service,tutor),/role/);
  }
  const draft=await prepareTask(parseTaskCommand('Add student Naila'),service,tutor);assert.equal(draft.draft,true);
  await assert.rejects(()=>runTask(draft,service,tutor),/role/);
  await assert.rejects(()=>prepareTask(parseTaskCommand('Show classes'),service,{role:'parent'}),/role/);
  await assert.rejects(()=>prepareTask(parseTaskCommand('Show classes'),service,{role:'tutor'}),/not linked/);
});
test('student, parent and class creation preserve known details without invented relationships',async()=>{
  const {service,calls}=fixture();
  for(const text of ['Add student Salma, Year 8, maths','Add parent Hana, phone: 55512345','Add tutor Amal']){
    const p=await prepareTask(parseTaskCommand(text),service,context);await runTask(p,service,context);
  }
  assert.equal(calls[0][1].full_name,'Salma');assert.deepEqual(calls[0][1].subjects,['maths']);assert.equal(calls[0][1].parent_id,null);
  assert.equal(calls[1][1].phone,'55512345');assert.equal(calls[2][1].full_name,'Amal');
  const p=await prepareTask(parseTaskCommand('Add class for Naila tomorrow at 5 PM',now),service,context);
  assert.equal(p.values.student_id,'s');p.values.tutor_id='t';p.values.subject='Maths';await runTask(p,service,context);
  assert.equal(calls.at(-1)[0],'createClass');assert.equal(calls.at(-1)[1].scheduled_at,'2026-11-17T14:00:00.000Z');
});
test('homework, materials and lesson notes use selected relationships and sharing',async()=>{
  const {service,calls}=fixture();
  const tutor={...context,role:'tutor'};
  const hw=await prepareTask(parseTaskCommand('Add homework Fractions for Naila, due: tomorrow',now),service,tutor);await runTask(hw,service,tutor);
  assert.equal(calls.at(-1)[1].tutor_id,'t');assert.equal(calls.at(-1)[1].student_id,'s');assert.equal(calls.at(-1)[1].due_at,'2026-11-17T15:00:00.000Z');
  const mat=await prepareTask(parseTaskCommand('Add material Worksheet for Naila, link: https://example.test/worksheet'),service,tutor);await runTask(mat,service,tutor);assert.equal(calls.at(-1)[0],'createMaterial');
  mat.values.file_url='javascript:alert(1)';await assert.rejects(()=>runTask(mat,service,tutor),/https/);
  const note=await prepareTask(parseTaskCommand('Add note for Naila, topic: Fractions'),service,tutor);
  await assert.rejects(()=>runTask(note,service,tutor),/Linked class/);
  note.values.class_id='c';await runTask(note,service,tutor);
  assert.equal(calls.at(-1)[1].is_shared_with_parent,false);assert.equal(calls.at(-1)[1].understanding,undefined);
  note.values.student_id='other';assert.throws(()=>validateTask(note,tutor),/accessible/);
});
test('attendance chooses a lesson rather than a person and stale previews stop writes',async()=>{
  const {service,data,calls}=fixture();const tutor={...context,role:'tutor'};
  let p=await prepareTask(parseTaskCommand('Mark Naila present today',now),service,tutor);
  await assert.rejects(()=>runTask(p,service,tutor),/exact record/);
  assert.equal(filterCommandRows(p,p.refs.target).length,1);p=selectTaskTarget(p,'c');await runTask(p,service,tutor);
  assert.deepEqual(calls.at(-1),['markAttendance','c','Present']);
  data.class[0].updated_at='v2';await assert.rejects(()=>runTask(p,service,tutor),/changed after/);
});
test('removals retain records and each specialized workflow uses its checked operation',async()=>{
  const {service,calls}=fixture();
  for(const [text,id,method] of [['Delete homework Fractions','h','softDeleteRecord'],['Cancel class Maths','c','updateClassStatus'],['Review homework Fractions, feedback: Good working','h','reviewHomework'],['Delete exam Maths','x','removeStudentExam'],['Close availability','a','closeAvailability'],['Confirm request for Naila','r','reviewBookingRequest'],['Delete calendar event Meeting','e','saveMasterCalendarEntry']]){
    let p=await prepareTask(parseTaskCommand(text),service,context);p=selectTaskTarget(p,id);await runTask(p,service,context);assert.equal(calls.at(-1)[0],method,text);
  }
  assert.deepEqual(calls.find(c=>c[0]==='softDeleteRecord'),['softDeleteRecord','homework','h']);
  const removed=calls.at(-1);assert.ok(removed[1].deleted_at);assert.equal(removed[2].version,2);assert.equal(removed[2].origin,'calendar');
  const reviewed=calls.find(c=>c[0]==='reviewHomework');assert.equal(reviewed[2],'Good working');
});
test('booking proposals preserve recurrence and decline requires a reason',async()=>{
  const {service,calls}=fixture();
  let p=await prepareTask(parseTaskCommand('Propose request for Naila'),service,context);p=selectTaskTarget(p,'r');p.values.scheduled_at='2026-11-18T17:00';await runTask(p,service,context);
  assert.equal(calls.at(-1)[1].version,3);assert.equal(calls.at(-1)[3].recurrence.count,4);
  p=await prepareTask(parseTaskCommand('Decline request for Naila'),service,context);p=selectTaskTarget(p,'r');await assert.rejects(()=>runTask(p,service,context),/Reason/);
});
test('timed calendars, student exams and availability validate durations and convert Qatar time',async()=>{
  const {service,calls}=fixture();
  const cal=await prepareTask(parseTaskCommand('Add calendar event Meeting tomorrow',now),service,context);cal.values.all_day=false;cal.values.starts_at='2026-11-17T23:30';cal.values.duration_min=90;await runTask(cal,service,context);
  assert.equal(calls.at(-1)[1].ends_on,'2026-11-18');assert.equal(calls.at(-1)[1].visibility,'private');
  const exam=await prepareTask(parseTaskCommand('Add exam Maths for Naila tomorrow at 9 AM',now),service,context);await runTask(exam,service,context);assert.equal(calls.at(-1)[0],'saveStudentExam');assert.equal(calls.at(-1)[1].student_id,'s');
  const avail=await prepareTask(parseTaskCommand('Add availability, start: 2026-11-17T14:00, end: 2026-11-17T19:00'),service,context);avail.values.tutor_id='t';await runTask(avail,service,context);assert.equal(calls.at(-1)[0],'publishAvailability');
  avail.values.ends_at='2026-11-18T20:00';await assert.rejects(()=>runTask(avail,service,context),/24 hours/);
});
test('retrying creation after a lost response recovers the original record',async()=>{
  const {service,data}=fixture();let writes=0;
  service.createParent=async payload=>{writes++;data.parent.push(payload);return {error:{message:'Network response lost'}};};
  const p=await prepareTask(parseTaskCommand('Add parent Hana'),service,context);
  await assert.rejects(()=>runTask(p,service,context),/lost/);const result=await runTask(p,service,context);assert.equal(result.record.id,p.id);assert.equal(writes,1);
});
test('reports return actual scoped rows and propagate read failures',async()=>{
  const {service,calls}=fixture();
  service.getAttendanceReport=async params=>{calls.push(params);return ok([{student:{id:'s',full_name:'Naila'},attendance:'Present',scheduled_at:'2026-11-16T14:00:00Z'},{student:{id:'other'},attendance:'Absent',scheduled_at:'2026-11-16T14:00:00Z'}]);};
  const p=await prepareTask(parseTaskCommand('Attendance report for Naila, from: 2026-11-16, to: 2026-11-16'),service,{...context,role:'tutor'});
  const r=await runTask(p,service,{...context,role:'tutor'});assert.equal(r.rows.length,1);assert.equal(calls.at(-1).tutorId,'t');
  service.getAttendanceReport=async()=>({error:{message:'Report unavailable'}});await assert.rejects(()=>runTask(p,service,context),/Report unavailable/);
});
test('family links and tutor assignments resolve existing people without creating new accounts',async()=>{
  const {service,data,calls}=fixture();data.student[0].parent_id='old-parent';
  let p=await prepareTask(parseTaskCommand('Link parent Fatima to Naila'),service,context);p=selectTaskTarget(p,'s');assert.equal(p.values.parent_id,'p');await runTask(p,service,context);
  assert.deepEqual(calls.at(-1),['updateStudent','s',{parent_id:'p'}]);
  data.assignment=[];service.getStudentTutors=async()=>ok(data.assignment);
  service.assignTutorToStudent=async(s,t,subjects)=>{calls.push(['assign',s,t,subjects]);const row={id:'assignment',student_id:s,tutor_id:t,is_active:true,student:{full_name:'Naila'},tutor:{full_name:'Amal'}};data.assignment.push(row);return ok(row);};
  service.removeStudentTutor=async id=>{calls.push(['revoke',id]);return ok({id,is_active:false});};
  p=await prepareTask(parseTaskCommand('Assign tutor Amal to Naila, subject: Maths'),service,context);await runTask(p,service,context);assert.deepEqual(calls.at(-1),['assign','s','t',['Maths']]);
  await runTask(p,service,context);assert.equal(calls.filter(c=>c[0]==='assign').length,1);
  p=await prepareTask(parseTaskCommand('Unlink tutor Amal from Naila'),service,context);p=selectTaskTarget(p,'assignment');await runTask(p,service,context);assert.deepEqual(calls.at(-1),['revoke','assignment']);
});
test('choosing a lesson fills the known student, tutor and topic',async()=>{
  const {service}=fixture();const p=await prepareTask(parseTaskCommand('Add note'),service,context);const next=changeTaskValue(p,'class_id','c');
  assert.equal(next.values.student_id,'s');assert.equal(next.values.tutor_id,'t');assert.equal(next.values.topic,'Maths');assert.doesNotThrow(()=>validateTask(next,context));
});
test('calendar lookup combines lessons, homework, requests and authored dates without changing them',async()=>{
  const {service,calls}=fixture();const p=await prepareTask(parseTaskCommand('Show calendar'),service,context);const r=await runTask(p,service,context);
  assert.ok(r.rows.some(row=>row.origin==='class'));assert.ok(r.rows.some(row=>row.origin==='calendar'));assert.ok(r.rows.some(row=>row.origin==='catalog'));
  assert.equal(calls.length,0);
});
