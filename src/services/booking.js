export const qatarInstant = value => value ? new Date(`${value}:00+03:00`).toISOString() : null;
export const qatarInput = value => value ? new Date(new Date(value).getTime()+3*3600000).toISOString().slice(0,16) : '';
export const bookingTime = value => new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Qatar',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export const activeRequest = request => ['Pending','Proposed'].includes(request.status);
export const DURATIONS=[60,90,120,150,180];
export const durationLabel=minutes=>`${minutes/60} ${minutes===60?'hour':'hours'}`;
export const WEEKDAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const FREQUENCIES={once:'One session',weekly:'Once a week',twice_weekly:'Twice a week',fortnightly:'Every two weeks',monthly:'Once a month'};
export const defaultRecurrence=()=>({frequency:'once',weekdays:[],count:1});
export function recurrenceTimes(start,rule=defaultRecurrence()) {
  if(!start)return [];
  const local=qatarInput(start),anchor=new Date(`${local}:00Z`),frequency=rule.frequency||'once';
  if(frequency==='once')return [new Date(start).toISOString()];
  const count=Number(rule.count),days=[...new Set((rule.weekdays||[]).map(Number))].sort();
  const required=frequency==='twice_weekly'?2:1;
  if(!FREQUENCIES[frequency]||!Number.isInteger(count)||count<2||count>24)throw Error('Choose 2–24 sessions.');
  if(frequency!=='monthly'&&(days.length!==required||days.some(d=>d<0||d>6)||!days.includes(anchor.getUTCDay())))throw Error(`Choose ${required} weekday${required===1?'':'s'}, including the first session day.`);
  const results=[];
  for(let offset=0;offset<=366&&results.length<count;offset++){
    const date=new Date(anchor.getTime()+offset*86400000);
    const weeks=Math.floor((offset+anchor.getUTCDay())/7);
    if(frequency==='monthly'?date.getUTCDate()===Math.min(anchor.getUTCDate(),new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()):days.includes(date.getUTCDay())&&(frequency!=='fortnightly'||weeks%2===0))results.push(new Date(date.getTime()-3*3600000).toISOString());
  }
  if(results.length!==count)throw Error('Choose fewer sessions to stay within one year.');
  return results;
}
export const recurrenceLabel=rule=>`${FREQUENCIES[rule?.frequency]||FREQUENCIES.once}${rule?.frequency&&rule.frequency!=='once'?` · ${rule.count} sessions${rule.frequency==='monthly'?'':` · ${(rule.weekdays||[]).map(d=>WEEKDAYS[d]).join(', ')}`}`:''}`;
export function bookingCalendarItems(requests=[]) {
  return requests.filter(activeRequest).flatMap(r=>(r.occurrence_times||[r.scheduled_at]).map((time,i)=>({
    id:`request-${r.id}-${i}`,request_id:r.id,student:{...r.student,full_name:r.student_name||r.student?.full_name},topic:r.student_name||'Booking request',
    subject:r.subject,scheduled_at:time,duration_min:r.duration_min,mode:r.mode,location:r.location,
    kind:r.status==='Proposed'?'Proposed':'Pending',
  })));
}
export function nearbyClasses(classes, time) {
  const date=qatarInput(time).slice(0,10);
  return classes.filter(c=>!c.deleted_at && !['Cancelled','Rescheduled'].includes(c.status) && qatarInput(c.scheduled_at).startsWith(date)).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at));
}
