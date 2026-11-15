import React, { useState } from 'react';
import { Button, Field, tokens } from '../ui';

const dateInQatar=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Qatar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const timeInQatar=value=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Qatar',hour:'2-digit',minute:'2-digit'}).format(new Date(value));

export default function SessionCalendar({sessions=[]}) {
  const [month,setMonth]=useState(()=>dateInQatar(new Date()).slice(0,7));
  const [year,number]=month.split('-').map(Number);
  const offset=new Date(Date.UTC(year,number-1,1)).getUTCDay();
  const days=new Date(Date.UTC(year,number,0)).getUTCDate();
  const shift=delta=>setMonth(new Date(Date.UTC(year,number-1+delta,1)).toISOString().slice(0,7));
  const visible=sessions.filter(session=>!session.deleted_at).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at));
  return <section aria-label="Class calendar">
    <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
      <Button variant="ghost" aria-label="Previous month" onClick={()=>shift(-1)}>Previous</Button>
      <Field label="Calendar month"><input type="month" value={month} onChange={event=>{if(/^\d{4}-\d{2}$/.test(event.target.value))setMonth(event.target.value);}}/></Field>
      <Button variant="ghost" aria-label="Next month" onClick={()=>shift(1)}>Next</Button>
      <span style={{fontSize:13,color:tokens.slate}}>All times in Qatar · {visible.filter(session=>dateInQatar(session.scheduled_at).startsWith(month)).length} sessions</span>
    </div>
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Monthly calendar, scroll horizontally on small screens">
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(120px,1fr))',minWidth:840,gap:1,background:tokens.line,border:`1px solid ${tokens.line}`,borderRadius:12,overflow:'hidden'}}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><div key={day} style={{background:tokens.tealSoft,padding:12,fontWeight:700}}>{day}</div>)}
        {Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>{
          const day=i-offset+1;const valid=day>0&&day<=days;const date=`${month}-${String(day).padStart(2,'0')}`;
          return <div key={i} style={{background:valid?'white':tokens.paper,minHeight:130,padding:8}}>
            {valid&&<><strong style={{fontSize:13}}>{day}</strong>{visible.filter(session=>dateInQatar(session.scheduled_at)===date).map(session=><article key={session.id} style={{background:tokens.tealSoft,borderRadius:8,padding:8,marginTop:7,fontSize:12}}>
              <strong>{session.student?.full_name||session.topic||'Class'}</strong>
              <div>{timeInQatar(session.scheduled_at)}–{timeInQatar(new Date(new Date(session.scheduled_at).getTime()+session.duration_min*60000))}</div>
              <div>{session.subject}</div>
            </article>)}</>}
          </div>;
        })}
      </div>
    </div>
  </section>;
}
