import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseStudentCommand,matchingStudents,loadCommandStudents,executeStudentCreate} from '../src/features/studentCommands.js';

test('commands extract supported fields without silently accepting extra tasks',()=>{
  assert.deepEqual(parseStudentCommand('Add student Naila, Year 8, maths').fields,{full_name:'Naila',grade:'Year 8',subjects:['maths'],curriculum:''});
  assert.equal(parseStudentCommand('Find student Naila').intent,'find');
  assert.equal(parseStudentCommand('search for Naila').fields.full_name,'Naila');
  for(const input of ['delete Naila','Add student','Add Naila, tomorrow','Add Naila and send invitation','Find Naila, Year 8']) assert.throws(()=>parseStudentCommand(input));
  const rows=[{id:'1',full_name:'Naila'},{id:'2',full_name:'Naila Ahmed'},{id:'3',full_name:'Naila',deleted_at:'today'}];
  assert.equal(matchingStudents(rows,'naila').length,2);
  assert.equal(matchingStudents(rows,'naila',true).length,1);
});

test('student commands enforce role boundary and tutor-scoped reads',async()=>{
  let calls=0;
  const service={getStudentsByTutor:async id=>{assert.equal(id,'t');calls++;return {data:[]};},createStudent:()=>{throw Error('must not write');}};
  await loadCommandStudents(service,'tutor','t');assert.equal(calls,1);
  await assert.rejects(()=>loadCommandStudents(service,'tutor',null),/not linked/);
  await assert.rejects(()=>loadCommandStudents(service,'parent'),/unavailable/);
  await assert.rejects(()=>executeStudentCreate({service,role:'tutor',id:'id',fields:{full_name:'Naila'}}),/Only authorized staff/);
});

test('retry recovers saved record after lost response without creating another student',async()=>{
  const rows=[];let inserts=0;
  const service={getStudents:async()=>({data:rows}),createStudent:async payload=>{inserts++;rows.push(payload);return {error:{message:'Connection lost'}};}};
  const args={service,role:'admin_tutor',id:'fixed-preview-id',fields:{full_name:'Naila',grade:'Year 8',subjects:['Maths'],curriculum:''}};
  await assert.rejects(()=>executeStudentCreate(args),/Connection lost/);
  const recovered=await executeStudentCreate(args);
  assert.equal(recovered.id,'fixed-preview-id');assert.equal(inserts,1);assert.equal(recovered.parent_id,null);
});
