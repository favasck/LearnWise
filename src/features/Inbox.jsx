import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Field } from '../ui';
import { supabase } from '../supabaseClient';
import { createMessagingService, mergeMessages } from '../services/messaging';
import './inbox.css';

const defaultService=createMessagingService(supabase);
const labels={admin:'Super Admin',super_admin:'Super Admin',admin_tutor:'Admin Tutor',tutor:'Tutor',parent:'Parent',student:'Student'};
const time=value=>new Date(value).toLocaleString('en-GB',{timeZone:'Asia/Qatar',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const failure=error=>/message_contacts|message_inbox|direct_messages|schema cache/i.test(error?.message||'')
  ? 'Messaging is not available yet. Please contact the academy administrator.' : 'Unable to load messages. Please try again.';

export default function Inbox({userId,initialPeer='',onPeerChange,service=defaultService}) {
  const [contacts,setContacts]=useState([]),[threads,setThreads]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [search,setSearch]=useState(''),[peer,setPeer]=useState(initialPeer);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>setPeer(initialPeer),[initialPeer]);
  useEffect(()=>{
    let alive=true,inFlight=false;
    async function load() {
      if(inFlight)return;inFlight=true;
      try {
        const [c,i]=await Promise.all([service.contacts(),service.inbox()]);
        if(c.error||i.error)throw c.error||i.error;
        if(alive){setContacts(c.data||[]);setThreads(i.data||[]);setError('');}
      } catch(e){if(alive)setError(failure(e));}
      finally {inFlight=false;if(alive)setLoading(false);}
    }
    load();const timer=setInterval(load,10000);
    return()=>{alive=false;clearInterval(timer);};
  },[service,userId,refresh]);
  const people=useMemo(()=>{
    const map=new Map(threads.map(t=>[t.peer_id,{id:t.peer_id,full_name:t.full_name,role:t.role,active:false}]));
    contacts.forEach(c=>map.set(c.id,{...c,active:true}));return map;
  },[contacts,threads]);
  const selected=people.get(peer);
  const choose=id=>{setPeer(id);onPeerChange?.(id);};
  const matching=contacts.filter(c=>`${c.full_name} ${labels[c.role]||c.role}`.toLowerCase().includes(search.toLowerCase()));
  const unread=threads.reduce((n,t)=>n+Number(t.unread),0);
  return <section aria-labelledby="inbox-title">
    <div className="inbox-heading"><div><h1 id="inbox-title">Inbox</h1><p>Send a private message to another LearnWise user.</p></div><span role="status">{unread?`${unread} unread`:'All caught up'}</span></div>
    {error&&<div role="alert" className="inbox-error">{error} <Button variant="ghost" onClick={()=>setRefresh(n=>n+1)}>Retry</Button></div>}
    {loading?<p role="status">Loading your inbox…</p>:<div className="inbox-layout">
      <aside className="inbox-sidebar" aria-label="Conversations and users">
        <h2>Conversations</h2>
        {!threads.length&&<p>No conversations yet. Choose a user below to start one.</p>}
        {threads.map(t=><button key={t.peer_id} className={`inbox-person ${peer===t.peer_id?'is-selected':''}`} onClick={()=>choose(t.peer_id)} aria-pressed={peer===t.peer_id}>
          <strong>{t.full_name}</strong><span>{labels[t.role]||t.role}{Number(t.unread)>0&&` · ${t.unread} unread`}</span><span className="inbox-preview">{t.body}</span><small>{time(t.created_at)}</small>
        </button>)}
        <h2>New message</h2>
        <Field label="Find a user"><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or role"/></Field>
        <div className="inbox-directory">{matching.map(c=><div key={c.id} className="inbox-contact"><div><strong>{c.full_name}</strong><small>{labels[c.role]||c.role}</small></div><Button variant="ghost" onClick={()=>choose(c.id)} aria-label={`Message ${c.full_name}`}>Message</Button></div>)}</div>
        {!matching.length&&<p>No users found.</p>}
      </aside>
      <div className="inbox-conversation">
        {selected?<Conversation key={`${userId}:${peer}`} userId={userId} person={selected} service={service} onChanged={()=>setRefresh(n=>n+1)}/>
          :<div className="inbox-placeholder"><h2>{peer?'User unavailable':'Your conversations, in one place'}</h2><p>{peer?'Choose an available user to send a message.':'Select a conversation or use Message beside a user to get started.'}</p></div>}
      </div>
    </div>}
  </section>;
}

export function Conversation({userId,person,service,onChanged}) {
  const [messages,setMessages]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [body,setBody]=useState(''),[sending,setSending]=useState(false),[notice,setNotice]=useState('');
  const [page,setPage]=useState(0),[more,setMore]=useState(false),[olderBusy,setOlderBusy]=useState(false);
  const pending=useRef(null),busy=useRef(false),alive=useRef(true);
  useEffect(()=>{
    alive.current=true;let inFlight=false;
    async function load(){
      if(inFlight)return;inFlight=true;
      try{
        const result=await service.thread(userId,person.id);
        if(result.error)throw result.error;
        if(!alive.current)return;
        setMessages(old=>mergeMessages(old,result.data||[]));setMore(old=>page===0?(result.data||[]).length===50:old);setError('');
        const unread=(result.data||[]).filter(m=>m.recipient_id===userId&&!m.read_at).map(m=>m.id);
        if(unread.length&&document.visibilityState!=='hidden'){
          const receipt=await service.markRead(userId,unread);if(receipt.error)throw receipt.error;
          if(alive.current)onChanged();
        }
      }catch(e){if(alive.current)setError(failure(e));}
      finally{inFlight=false;if(alive.current)setLoading(false);}
    }
    load();const timer=setInterval(load,5000);window.addEventListener('focus',load);
    return()=>{alive.current=false;clearInterval(timer);window.removeEventListener('focus',load);};
  },[userId,person.id,service,page]);
  async function older(){
    setOlderBusy(true);
    try{
      const result=await service.thread(userId,person.id,page+1);if(result.error)throw result.error;
      if(!alive.current)return;
      setMessages(old=>mergeMessages(result.data||[],old));setPage(p=>p+1);setMore((result.data||[]).length===50);
      const unread=(result.data||[]).filter(m=>m.recipient_id===userId&&!m.read_at).map(m=>m.id);
      if(unread.length){const r=await service.markRead(userId,unread);if(r.error)throw r.error;if(alive.current)onChanged();}
    }catch(e){if(alive.current)setError(failure(e));}finally{if(alive.current)setOlderBusy(false);}
  }
  async function send(e){
    e.preventDefault();const text=body.trim();if(!text||text.length>4000||busy.current||!person.active)return;
    busy.current=true;setSending(true);setNotice('');
    if(!pending.current||pending.current.body!==text)pending.current={id:crypto.randomUUID(),body:text};
    try{
      const result=await service.send(userId,person.id,text,pending.current.id);
      if(result.error&&result.error.code!=='23505')throw result.error;
      if(!alive.current)return;
      if(result.data)setMessages(old=>mergeMessages(old,[result.data]));
      setBody('');pending.current=null;setNotice('Message sent.');onChanged();
    }catch(e){if(alive.current)setNotice('Message could not be sent. Your draft is saved here; please try again.');}
    finally{busy.current=false;if(alive.current)setSending(false);}
  }
  return <><header className="inbox-thread-heading"><h2>{person.full_name}</h2><span>{labels[person.role]||person.role}</span></header>
    {error&&<p role="alert" className="inbox-error">{error}</p>}
    {loading?<p role="status">Loading conversation…</p>:<>
      {more&&<Button variant="ghost" onClick={older} disabled={olderBusy}>{olderBusy?'Loading…':'Load older messages'}</Button>}
      <ol className="inbox-messages" aria-label={`Messages with ${person.full_name}`}>
        {!messages.length&&<li className="inbox-placeholder">No messages yet. Say hello.</li>}
        {messages.map(m=><li key={m.id} className={`inbox-bubble ${m.sender_id===userId?'is-mine':''}`}><strong>{m.sender_id===userId?'You':person.full_name}</strong><p>{m.body}</p><small>{time(m.created_at)}{m.sender_id===userId?m.read_at?' · Read':' · Sent':''}</small></li>)}
      </ol>
    </>}
    <form className="inbox-compose" onSubmit={send}>
      {person.active?<><Field label={`Message ${person.full_name}`}><textarea rows={3} maxLength={4000} value={body} disabled={sending} onChange={e=>setBody(e.target.value)} placeholder="Write a message…"/></Field><div className="inbox-heading"><small>{body.length}/4000</small><Button type="submit" disabled={sending||!body.trim()}>{sending?'Sending…':'Send message'}</Button></div></>:<p>This account is unavailable for new messages.</p>}
      {notice&&<p role="status">{notice}</p>}
    </form>
  </>;
}
