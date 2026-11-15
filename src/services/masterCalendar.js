import dates from '../data/masterCalendarDates.json' with { type:'json' };
import { bookingCalendarItems, qatarInput } from './booking.js';

export const CALENDAR_CATEGORIES={Class:'Classes',Exam:'Exam dates',QatarHoliday:'Qatar holidays & dates',Task:'Tasks & homework',Request:'Booking requests',Other:'Other dates'};
export const canManageCalendar=role=>['super_admin','admin','admin_tutor','tutor'].includes(role);
export const CALENDAR_CHECKED_ON=dates.checked_on;
export const CALENDAR_SOURCES=dates.sources.map(({rows,...source})=>({...source,count:rows.length}));
const dateOnly=value=>qatarInput(value).slice(0,10);
const knownTime=(time,duration=1)=>({starts_on:dateOnly(time),ends_on:dateOnly(new Date(new Date(time).getTime()+duration*60000-1)),starts_at:time,all_day:false,duration_min:duration});
export function officialExamEntries() {
  return dates.sources.flatMap(source=>source.rows.map(([syllabus,paper,title,starts_on,ends_on,session_label,duration_min,source_page])=>({
    id:`catalog:${source.key}-${syllabus}-${paper}`,catalog_key:`${source.key}-${syllabus}-${paper}`,
    title:`${title} · ${syllabus}/${paper}`,category:'Exam',visibility:'shared',board:source.board,syllabus,paper,zone:source.zone,series:source.series,
    starts_on,ends_on,all_day:true,starts_at:null,duration_min,session_label,source_url:source.source_url,source_page,
    verification:'Published timetable',notes:`${source.board==='Cambridge'?'Cambridge IGCSE / IGCSE (9–1), zone 3.':'Pearson Edexcel International GCSE, standard non-R papers.'} Confirm the centre's zone, paper entry and local start time.${session_label==='Window'?' Practical/speaking window: the centre determines the sitting date.':''}`,
    task_status:'Open',origin:'catalog',
  })));
}
function hijriDates(year) {
  const formatter=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{timeZone:'UTC',month:'numeric',day:'numeric'});
  const result={};
  for(let d=new Date(Date.UTC(year,0,1));d.getUTCFullYear()===year;d=new Date(d.getTime()+86400000)){
    const parts=Object.fromEntries(formatter.formatToParts(d).map(p=>[p.type,p.value]));
    for(const [key,month,day] of [['ramadan',9,1],['fitrStart',9,28],['fitrEnd',10,4],['adhaStart',12,9],['adhaEnd',12,13]])if(Number(parts.month)===month&&Number(parts.day)===day)result[key]=d.toISOString().slice(0,10);
  }
  return result;
}
export function qatarHolidayEntries(years=[2026,2027]) {
  const source_url='https://www.cm.gov.qa/en/Pages/official_holidays.aspx';
  return years.flatMap(year=>{
    const first=new Date(Date.UTC(year,1,1)).getUTCDay(),sports=`${year}-02-${String(1+(2-first+7)%7+7).padStart(2,'0')}`;
    const h=hijriDates(year);
    return [
      ['national-day','Qatar National Day',`${year}-12-18`,`${year}-12-18`,'Official rule',''],
      ['sports-day','Qatar National Sports Day',sports,sports,'Official rule','Second Tuesday in February.'],
      ['eid-fitr','Eid al-Fitr holiday (estimated)',h.fitrStart,h.fitrEnd,'Provisional','Projected Hijri conversion: Ramadan 28–Shawwal 4. Await Qatar announcement; actual dates may differ.'],
      ['eid-adha','Eid al-Adha holiday (estimated)',h.adhaStart,h.adhaEnd,'Provisional','Projected Hijri conversion: Dhu al-Hijjah 9–13. Await Qatar announcement; actual dates may differ.'],
      ['ramadan','Ramadan begins (estimated observance)',h.ramadan,h.ramadan,'Provisional','Estimated observance, not a public holiday. Await Qatar announcement.'],
    ].filter(r=>r[2]&&r[3]).map(([key,title,starts_on,ends_on,verification,notes])=>({id:`catalog:qatar-${year}-${key}`,catalog_key:`qatar-${year}-${key}`,title,starts_on,ends_on,category:'QatarHoliday',visibility:'shared',all_day:true,starts_at:null,duration_min:null,board:'',series:String(year),zone:'Qatar',syllabus:'',paper:'',session_label:'',verification,notes,source_url,origin:'catalog',task_status:'Open'}));
  });
}
export function mergeCalendarCatalogue(catalogue,entries) {
  const overrides=new Map(entries.filter(e=>e.catalog_key).map(e=>[e.catalog_key,e]));
  const merged=catalogue.map(base=>{const saved=overrides.get(base.catalog_key);return saved?{...base,...saved,origin:'calendar',original:base}:base;});
  const keys=new Set(catalogue.map(e=>e.catalog_key));
  return [...merged,...entries.filter(e=>!e.catalog_key||!keys.has(e.catalog_key)).map(e=>({...e,origin:'calendar'}))];
}
export function masterCalendarEntries({entries=[],classes=[],exams=[],requests=[],homework=[]},catalogue=[...officialExamEntries(),...qatarHolidayEntries()]) {
  return [
    ...mergeCalendarCatalogue(catalogue,entries),
    ...classes.filter(c=>!c.deleted_at&&!['Cancelled','Rescheduled'].includes(c.status)).map(c=>({id:`class:${c.id}`,title:`${c.student?.full_name||'Class'} · ${c.subject}`,category:'Class',...knownTime(c.scheduled_at,c.duration_min),notes:`${c.tutor?.full_name||''} · ${c.mode==='Online'?'Online':c.location||'In person'}`,origin:'class',verification:c.status||'Scheduled'})),
    ...exams.filter(e=>!e.deleted_at).map(e=>({id:`exam:${e.id}`,title:`${e.student?.full_name||'Student'} · ${e.title}`,category:'Exam',...knownTime(e.scheduled_at,e.duration_min),notes:e.notes,origin:'exam',verification:'Student exam',board:'Student exams'})),
    ...bookingCalendarItems(requests).map(e=>({...e,id:`booking:${e.id}`,title:`${e.student?.full_name||'Booking request'} · ${e.subject}`,category:'Request',...knownTime(e.scheduled_at,e.duration_min),origin:'request',verification:e.kind,notes:'Pending/proposed: not reserved.'})),
    ...homework.filter(h=>!h.deleted_at&&h.due_at).map(h=>({id:`homework:${h.id}`,title:`${h.student?.full_name||'Homework'} · ${h.title}`,category:'Task',...knownTime(h.due_at),notes:'Homework deadline. Manage the assignment from Homework.',origin:'homework',task_status:['Submitted','Reviewed','Completed'].includes(h.status)?'Done':'Open',verification:h.status||'Homework'})),
  ].sort((a,b)=>a.starts_on.localeCompare(b.starts_on)||(a.starts_at||'').localeCompare(b.starts_at||'')||a.title.localeCompare(b.title));
}
export function filterCalendarEntries(entries,{categories=Object.keys(CALENDAR_CATEGORIES),month='',board='',search='',taskStatus='',showRemoved=false}={}) {
  const first=month?`${month}-01`:'',last=month?new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10):'';
  const query=search.trim().toLowerCase();
  return entries.filter(e=>(showRemoved||!e.deleted_at)&&categories.includes(e.category)&&(!month||(e.starts_on<=last&&e.ends_on>=first))&&(!board||e.category!=='Exam'||e.board===board)&&(!taskStatus||e.category!=='Task'||e.task_status===taskStatus)&&(!query||[e.title,e.notes,e.board,e.syllabus,e.paper,e.series,e.zone].filter(Boolean).join(' ').toLowerCase().includes(query)));
}
export function calendarEntryPayload(entry,changes={}) {
  const values={...entry,...changes};
  const fields=['title','category','visibility','starts_on','ends_on','all_day','starts_at','duration_min','board','syllabus','paper','zone','series','session_label','source_url','verification','notes','task_status','deleted_at'];
  return Object.fromEntries(fields.map(key=>[key,values[key]??(['starts_at','duration_min','deleted_at'].includes(key)?null:key==='all_day'?true:key==='visibility'?'shared':key==='task_status'?'Open':key==='verification'?'Tutor entered':'')]));
}
