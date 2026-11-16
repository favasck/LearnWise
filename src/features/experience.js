export const academyZone = 'Asia/Qatar';
export function academyDate(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {timeZone:academyZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function academyDayRange(value = new Date()) {
  const day = academyDate(value);
  return {from:`${day}T00:00:00+03:00`,to:`${day}T23:59:59.999+03:00`};
}
export function lessonTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Time to be confirmed';
  return new Intl.DateTimeFormat('en-GB',{timeZone:academyZone,weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}
export function safeMeetingUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}
export function nextLesson(classes = [], now = Date.now()) {
  return classes.filter(c => !c.deleted_at && c.status === 'Scheduled' && new Date(c.scheduled_at).getTime() + (Number(c.duration_min)||60)*60000 > now)
    .sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at))[0] || null;
}
export function homeworkOrder(items = []) {
  return [...items].filter(item=>!item.deleted_at).sort((a,b)=>(Date.parse(a.due_at)||Infinity)-(Date.parse(b.due_at)||Infinity));
}
export const experienceLabels = {inbox:'Inbox',dashboard:'Overview',learning:'Learning',myclasses:'Lessons',classes:'Lessons',mystudents:'Students',mychild:'Children',classnotes:'Lesson feedback',materials:'Resources',payments:'Billing',assessments:'Enquiries',profile:'Account settings',calendar:'Calendar'};
export function navigationGroup(key) {
  if (['dashboard','calendar','bookings','inbox'].includes(key)) return 'Start here';
  if (['payments','reports'].includes(key)) return 'Finance & reports';
  if (['users','auditlogs','settings','qatest','profile'].includes(key)) return 'Administration & account';
  return 'Learning';
}
