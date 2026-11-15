import React, { useState } from 'react';
import { Button, Field, tokens } from '../ui';
import { QA_CHECKLIST, QA_CHECKLIST_VERSION } from './qaChecklist';

export default function QAReleaseChecklist() {
  const [checks,setChecks]=useState({});
  const [release,setRelease]=useState('');
  const [tester,setTester]=useState('');
  const [environment,setEnvironment]=useState('');
  const cases=QA_CHECKLIST.flatMap(([,items])=>items);
  const count=status=>cases.filter(([id])=>(checks[id]?.status||'Not Tested')===status).length;
  const update=(id,key,value)=>setChecks(current=>({...current,[id]:{...current[id],[key]:value}}));
  function download() {
    const report={checklistVersion:QA_CHECKLIST_VERSION,release,tester,environment,exportedAt:new Date().toISOString(),results:QA_CHECKLIST.flatMap(([area,items])=>items.map(([id,expected])=>({id,area,expected,status:checks[id]?.status||'Not Tested',evidence:checks[id]?.evidence||''})))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='learnwise-qa-results.json';link.click();URL.revokeObjectURL(url);
  }
  return <section aria-label="Release QA checklist" style={{background:tokens.cardBg,border:`1px solid ${tokens.line}`,borderRadius:14,padding:20,marginBottom:20}}>
    <h2 style={{marginTop:0}}>Release QA checklist</h2>
    <p>Test every role with invented records in a test environment. Basic system checks confirm data access only; they do not complete these workflow or permission checks.</p>
    <p>Record evidence for each result. Leave unverified checks as Not Tested; use Blocked for missing services and N/A with a reason. Results stay on this page until you leave or reload; download them first.</p>
    <div className="responsive-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
      <Field label="Build or commit"><input value={release} onChange={e=>setRelease(e.target.value)}/></Field>
      <Field label="Tester"><input value={tester} onChange={e=>setTester(e.target.value)}/></Field>
      <Field label="Test environment or URL"><input value={environment} onChange={e=>setEnvironment(e.target.value)}/></Field>
    </div>
    <p role="status">{count('Passed')} passed · {count('Failed')} failed · {count('Blocked')} blocked · {count('Not Tested')} not tested · {count('N/A')} N/A</p>
    {QA_CHECKLIST.map(([area,items])=><details key={area} style={{borderTop:`1px solid ${tokens.line}`,padding:'12px 0'}}>
      <summary style={{cursor:'pointer',fontWeight:700}}>{area}</summary>
      {items.map(([id,expected])=><article key={id} style={{padding:'12px 0'}}>
        <p id={`${id}-expected`}><strong>{id}</strong> — {expected}</p>
        <Field label={`${id} result`}><select aria-describedby={`${id}-expected`} value={checks[id]?.status||'Not Tested'} onChange={e=>update(id,'status',e.target.value)}>{['Not Tested','Passed','Failed','Blocked','N/A'].map(status=><option key={status}>{status}</option>)}</select></Field>
        <Field label={`${id} evidence or issue`}><textarea rows={2} value={checks[id]?.evidence||''} onChange={e=>update(id,'evidence',e.target.value)} placeholder="Observed result, test reference, evidence link or blocker; no passwords or private student details."/></Field>
      </article>)}
    </details>)}
    <Button variant="secondary" onClick={download}>Download QA results</Button>
  </section>;
}
