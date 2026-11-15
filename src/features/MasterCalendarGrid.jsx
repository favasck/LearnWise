import React from 'react';
import { tokens } from '../ui';
import { CALENDAR_CATEGORIES } from '../services/masterCalendar';
import { qatarInput } from '../services/booking';

export const calendarColors={Class:tokens.tealSoft,Exam:tokens.coralSoft,QatarHoliday:tokens.warnBg,Task:'#EAE8F5',Request:'#E7F0FA',Other:'#EEF0F0'};
export function eventWhen(event) {
  if(event.all_day)return event.session_label?`${event.session_label} · centre sets local time`:'All day';
  return `${qatarInput(event.starts_at).slice(11)}${event.origin==='homework'?' deadline':event.duration_min?` · ${event.duration_min} min`:''}`;
}
export default function MasterCalendarGrid({month,events,onSelect,onDay}) {
  const [year,number]=month.split('-').map(Number),offset=new Date(Date.UTC(year,number-1,1)).getUTCDay(),days=new Date(Date.UTC(year,number,0)).getUTCDate();
  return <div className="table-scroll" tabIndex={0} role="region" aria-label="Master calendar month, scroll horizontally on small screens"><div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(120px,1fr))',minWidth:840,gap:1,background:tokens.line,border:`1px solid ${tokens.line}`,borderRadius:12,overflow:'hidden'}}>
    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><div key={day} style={{background:tokens.tealSoft,padding:12,fontWeight:700}}>{day}</div>)}
    {Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>{
      const day=i-offset+1,valid=day>0&&day<=days,date=`${month}-${String(day).padStart(2,'0')}`;
      const entries=valid?events.filter(e=>e.starts_on<=date&&e.ends_on>=date):[];
      return <div key={i} style={{background:valid?'white':tokens.paper,minHeight:155,padding:8}}>{valid&&<>
        <button type="button" onClick={()=>onDay(date)} aria-label={`View dates on ${date}`} style={{border:0,background:'transparent',fontWeight:700,cursor:'pointer'}}>{day}</button>
        {entries.slice(0,3).map(event=><button type="button" key={event.id} onClick={()=>onSelect(event)} style={{display:'block',width:'100%',textAlign:'left',border:0,borderRadius:7,padding:7,marginTop:6,background:calendarColors[event.category],fontSize:11,cursor:'pointer',opacity:event.deleted_at?0.5:1}}>
          <strong>{CALENDAR_CATEGORIES[event.category]}</strong><div>{event.title}</div><div>{eventWhen(event)}</div>{event.verification==='Provisional'&&<strong>Provisional</strong>}{event.deleted_at&&<strong>Removed</strong>}
        </button>)}
        {entries.length>3&&<button type="button" className="button button--ghost" style={{fontSize:11,padding:'6px 0'}} onClick={()=>onDay(date)}>{entries.length-3} more · view day</button>}
      </>}</div>;
    })}
  </div></div>;
}
