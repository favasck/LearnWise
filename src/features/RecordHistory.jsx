import React, { useEffect, useState } from 'react';
import { Modal, tokens } from '../ui';
import { getRecordHistory } from '../services/supabaseData';

export default function RecordHistory({table,id,onClose,loadHistory=getRecordHistory}) {
  const [rows,setRows]=useState(null);
  const [error,setError]=useState('');
  useEffect(()=>{let active=true;loadHistory(table,id).then(({data,error})=>{if(active){setRows(data||[]);setError(error?.message||'');}}).catch(()=>{if(active)setError('Unable to load history. Please try again.');});return()=>{active=false;};},[table,id,loadHistory]);
  return <Modal title="Change history" wide onClose={onClose}>
    {error?<p role="alert">{error}</p>:!rows?<p>Loading history…</p>:rows.length===0?<p>No recorded changes yet.</p>:rows.map(row=>{
      const changed=Object.keys(row.new_data||{}).filter(key=>!['updated_at','edited_at','edited_by','deleted_by','owner_user_id','id'].includes(key)&&JSON.stringify(row.new_data[key])!==JSON.stringify(row.old_data?.[key]));
      return <article key={row.id} style={{borderBottom:`1px solid ${tokens.line}`,padding:'14px 0'}}>
        <strong style={{textTransform:'capitalize'}}>{row.action}</strong> · {new Date(row.created_at).toLocaleString('en-GB',{timeZone:'Asia/Qatar'})} (Qatar)
        <p style={{fontSize:12,color:tokens.slate}}>By {row.actor_role?.replaceAll('_',' ')||'LearnWise'}{row.actor_user_id?` · ${row.actor_user_id}`:''}</p>
        {row.old_data&&changed.map(key=><div key={key} style={{fontSize:13,overflowWrap:'anywhere',marginBottom:6}}><strong>{key.replaceAll('_',' ')}:</strong> {String(row.old_data[key]??'—')} → {String(row.new_data[key]??'—')}</div>)}
      </article>;
    })}
  </Modal>;
}
