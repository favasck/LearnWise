import React from 'react';
import { Field } from '../ui';
import { DURATIONS, durationLabel, FREQUENCIES, WEEKDAYS, qatarInput, recurrenceTimes } from '../services/booking';

export const bookingGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:14};
export function DurationField({value,onChange,label='Session length'}) {
  return <Field label={label} required><select value={value} onChange={e=>onChange(Number(e.target.value))}>
    {!DURATIONS.includes(Number(value))&&<option value={value}>{durationLabel(Number(value))} (existing request)</option>}
    {DURATIONS.map(minutes=><option key={minutes} value={minutes}>{durationLabel(minutes)}</option>)}
  </select></Field>;
}
export function RecurrenceFields({value,onChange,firstTime,labelPrefix=''}) {
  const frequency=value.frequency||'once';
  const day=firstTime?new Date(`${firstTime}:00Z`).getUTCDay():null;
  function changeFrequency(next) {
    const weekdays=next==='monthly'||next==='once'?[]:[...(day===null?[]:[day])];
    onChange({frequency:next,weekdays,count:next==='once'?1:next==='monthly'?3:8});
  }
  let dates=[],error='';
  try{if(firstTime)dates=recurrenceTimes(new Date(`${firstTime}:00+03:00`).toISOString(),value);}catch(e){error=e.message;}
  return <div>
    <div style={bookingGrid}><Field label={`${labelPrefix}Repeat`}><select value={frequency} onChange={e=>changeFrequency(e.target.value)}>{Object.entries(FREQUENCIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field>
      {frequency!=='once'&&<Field label={`${labelPrefix}Number of sessions`} required><input type="number" min="2" max={frequency==='monthly'?12:24} value={value.count} onChange={e=>onChange({...value,count:Number(e.target.value)})}/></Field>}
    </div>
    {!['once','monthly'].includes(frequency)&&<fieldset style={{border:'1px solid #E7E1D6',borderRadius:10,margin:'8px 0',padding:12}}><legend>{labelPrefix}Session days</legend>
      <p>Select {frequency==='twice_weekly'?'two days':'one day'}, including the first session day. Sessions start at the same time on each chosen day.</p>
      <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>{WEEKDAYS.map((name,index)=><label key={name} style={{display:'flex',gap:6,alignItems:'center'}}><input type="checkbox" checked={(value.weekdays||[]).includes(index)} onChange={e=>onChange({...value,weekdays:e.target.checked?[...(value.weekdays||[]),index].sort():value.weekdays.filter(d=>d!==index)})}/>{name}</label>)}</div>
    </fieldset>}
    {frequency==='monthly'&&<p>Same date each month, using the last day for shorter months.</p>}
    {error&&<p role="alert">{error}</p>}
    {dates.length>0&&<details><summary>{dates.length} planned {dates.length===1?'session':'sessions'} · review dates</summary><ol>{dates.map(date=><li key={date}>{qatarInput(date).replace('T',' · ')}</li>)}</ol></details>}
  </div>;
}
