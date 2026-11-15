export const qatarInstant = value => value ? new Date(`${value}:00+03:00`).toISOString() : null;
export const qatarInput = value => value ? new Date(new Date(value).getTime()+3*3600000).toISOString().slice(0,16) : '';
export const bookingTime = value => new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Qatar',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export const activeRequest = request => ['Pending','Proposed'].includes(request.status);
export function nearbyClasses(classes, time) {
  const date=qatarInput(time).slice(0,10);
  return classes.filter(c=>!c.deleted_at && !['Cancelled','Rescheduled'].includes(c.status) && qatarInput(c.scheduled_at).startsWith(date)).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at));
}
