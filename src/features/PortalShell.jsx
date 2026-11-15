import React, { useEffect, useRef, useState } from 'react';
import { GraduationCap, LogOut, Menu, MoreHorizontal, X } from 'lucide-react';
import { Button } from '../ui';
import { NavLink } from './navigation';
import { navigationGroup } from './experience';
import { mobileDestinations, activeMobileDestination } from './mobileNavigation';

export default function PortalShell({ nav, role, roleLabel, current, setCurrent, onLogout, children, who }) {
  const [open,setOpen] = useState(false);
  const [keyboardOpen,setKeyboardOpen]=useState(false);
  const drawer = useRef(null);
  const trigger = useRef(null);
  const opener=useRef(null);
  const destinations=mobileDestinations(nav,role);
  const active=activeMobileDestination(current,role,destinations);
  const openDrawer=event=>{opener.current=event.currentTarget;setOpen(true);};
  const groups = ['Start here','Learning','Finance & reports','Administration & account'].filter(group=>nav.some(item=>navigationGroup(item.key)===group));
  const close = (restore=true) => { setOpen(false); if (drawer.current?.open) drawer.current.close(); if(restore)(opener.current||trigger.current)?.focus(); };
  useEffect(()=>{const viewport=window.visualViewport;if(!viewport)return;const update=()=>setKeyboardOpen(window.innerHeight-viewport.height>160&&!!document.activeElement?.matches('input,textarea,select,[contenteditable=true]'));viewport.addEventListener('resize',update);document.addEventListener('focusout',update);return()=>{viewport.removeEventListener('resize',update);document.removeEventListener('focusout',update);};},[]);
  useEffect(() => {
    const query = window.matchMedia('(min-width:761px)');
    const resize = () => { if (query.matches) { setOpen(false); drawer.current?.close(); } };
    query.addEventListener('change',resize);
    return () => query.removeEventListener('change',resize);
  }, []);
  useEffect(() => { if (open) drawer.current?.showModal(); }, [open]);
  const sidebar = mobile => <>
    <NavLink to="/portal/dashboard" onNavigate={() => { if (mobile) close(); setCurrent('dashboard'); }} className="brand"><span className="brand__mark"><GraduationCap size={22}/></span><span><span className="brand__name">LearnWise</span><span className="brand__sub">Academy</span></span></NavLink>
    {mobile && <Button variant="ghost" aria-label="Close portal navigation" onClick={close} style={{marginBottom:16}}><X size={18}/>Close menu</Button>}
    <nav className="portal-nav" aria-label="Portal navigation">{groups.map(group=><div className="portal-nav__group" key={group}><div className="portal-nav__label">{group}</div>{nav.filter(item=>navigationGroup(item.key)===group).map(({key,label,icon:Icon}) => <NavLink key={key} to={`/portal/${key}`} onNavigate={() => { if (mobile) close(false); setCurrent(key); }} aria-current={current === key ? 'page' : undefined}><Icon size={18} aria-hidden="true"/>{label}</NavLink>)}</div>)}</nav>
    <div className="portal-account"><NavLink to="/portal/profile" onNavigate={() => { if (mobile) close(); setCurrent('profile'); }} aria-label="Open your profile settings"><strong>{who}</strong></NavLink><small>{roleLabel}</small><Button variant="ghost" icon={LogOut} onClick={() => { if (mobile) close(); onLogout(); }}>Sign out</Button></div>
  </>;
  return <div className={`portal-shell ${destinations.length?'portal-shell--mobile-tabs':''} ${keyboardOpen?'portal-shell--keyboard':''}`}>
    <a className="skip-link" href="#portal-content">Skip to content</a>
    <aside className="portal-sidebar">{sidebar(false)}</aside>
    <dialog className="portal-drawer" ref={drawer} aria-label="Portal navigation menu" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}><div className="portal-sidebar is-open">{sidebar(true)}</div></dialog>
    <div className="portal-workspace"><header className="portal-header"><div className="portal-header__context"><span className="portal-workspace-label">Your workspace</span><h1>{nav.find(item => item.key === current)?.label || 'Dashboard'}</h1></div><span className="portal-header__context portal-header__role">{roleLabel} portal</span><button type="button" ref={trigger} className="button button--ghost portal-mobile-toggle" aria-label="Open portal navigation" aria-expanded={open} onClick={openDrawer}><Menu size={20}/></button></header>
      <main id="portal-content" className="portal-content" tabIndex={-1}><div className="portal-timezone">Academy times · Qatar (UTC+3)</div>{children}</main>
    </div>
    {destinations.length>0&&<nav className="portal-bottom-nav" aria-label="Mobile primary navigation">{destinations.map(({key,label,icon:Icon})=><NavLink key={key} to={`/portal/${key}`} onNavigate={()=>setCurrent(key)} aria-current={active===key?'page':undefined}><Icon size={21} aria-hidden="true"/><span>{label}</span></NavLink>)}<button type="button" aria-label="More portal destinations" aria-expanded={open} aria-current={active==='more'?'page':undefined} onClick={openDrawer}><MoreHorizontal size={21} aria-hidden="true"/><span>More</span></button></nav>}
  </div>;
}
