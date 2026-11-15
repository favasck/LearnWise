// Intentionally bounded commands: unrecognized text never becomes a write.
export const commandStaff = role => ['super_admin','admin_tutor','admin'].includes(role);
export function parseStudentCommand(input) {
  const text = input.trim();
  if (/\b(?:and|then)\s+(?:add|create|delete|send|book|move|invite|assign)\b|[;\n]/i.test(text)) throw new Error('Please enter one student task at a time.');
  const match = /^(add|create|find|show|search)(?:\s+for)?\s+(?:student\s+)?(.*)$/i.exec(text);
  if (!match) throw new Error('Try “Add student Naila” or “Find student Naila”. Other tasks are not supported here yet.');
  const intent = /add|create/i.test(match[1]) ? 'create' : 'find';
  const parts = match[2].split(',').map(s=>s.trim());
  const name = parts.shift();
  if (!name || /^student$/i.test(name)) throw new Error('What is the student’s name? Add it to your command.');
  if (name.length > 150) throw new Error('Please use a student name of 150 characters or fewer.');
  const fields = {full_name:name,grade:'',subjects:[],curriculum:''};
  if (intent==='find' && parts.length) throw new Error('Search by name only, for example “Find student Naila”.');
  for (const part of parts) {
    if (/^(year|grade)\s+\d{1,2}$/i.test(part) && !fields.grade) fields.grade=part;
    else if (/^subjects?:\s*\S/i.test(part)) fields.subjects.push(...part.replace(/^subjects?:\s*/i,'').split('&').map(s=>s.trim()).filter(Boolean));
    else if (/^(maths|mathematics|english|physics|chemistry|biology|computer science|economics|history|geography)$/i.test(part)) fields.subjects.push(part);
    else if (/^curriculum:\s*\S/i.test(part) && !fields.curriculum) fields.curriculum=part.replace(/^curriculum:\s*/i,'');
    else throw new Error('Use labelled details: “Add student Naila, Year 8, subject: Maths, curriculum: IGCSE”. Please enter other details in the student form.');
  }
  return {intent,fields};
}
export const matchingStudents = (students,name,exact=false) => students.filter(s=>!s.deleted_at && (exact ? s.full_name.trim().toLocaleLowerCase()===name.trim().toLocaleLowerCase() : s.full_name.toLocaleLowerCase().includes(name.toLocaleLowerCase())));

export async function loadCommandStudents(service,role,tutorId) {
  if (!commandStaff(role) && role!=='tutor') throw new Error('Student commands are unavailable for this role.');
  if (role==='tutor' && !tutorId) throw new Error('Your tutor profile is not linked yet.');
  const result = await (role==='tutor' ? service.getStudentsByTutor(tutorId) : service.getStudents());
  if (result.error) throw new Error(result.error.message);
  return (result.data||[]).filter(s=>!s.deleted_at);
}

export async function executeStudentCreate({service,role,id,fields}) {
  if (!commandStaff(role)) throw new Error('Only authorized staff can create student records. Your draft has not been saved.');
  const name=fields.full_name.trim();
  if (!name || name.length>150) throw new Error('Enter a student name of 1–150 characters.');
  // Reuse a preview ID across retries. The primary key prevents a second insert,
  // including when the first response was lost after the server committed.
  const rows=await loadCommandStudents(service,role);
  const existing=rows.find(s=>s.id===id);
  if (existing) return existing;
  const result=await service.createStudent({id,full_name:name,grade:fields.grade.trim(),subjects:fields.subjects.map(s=>s.trim()).filter(Boolean),curriculum:fields.curriculum.trim(),status:'Active',parent_id:null});
  if (result.error) throw new Error(result.error.message);
  if (!result.data?.id) throw new Error('Unable to verify the saved record. Retry this preview to check its status.');
  return result.data;
}
