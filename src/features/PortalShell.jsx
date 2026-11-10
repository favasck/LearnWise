import React, { useEffect, useRef, useState } from 'react';
import { GraduationCap, LogOut, Menu, X } from 'lucide-react';
import { Button } from '../ui';
import { NavLink } from './navigation';

export default function PortalShell({ nav, roleLabel, current, setCurrent, onLogout, children, who }) {
  const [open,setOpen] = useState(false);
  const drawer = useRef(null);
  const trigger = useRef(null);
  const close = () => { setOpen(false); if (drawer.current?.open) drawer.current.close(); trigger.current?.focus(); };
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
    <nav className="portal-nav" aria-label="Portal navigation">{nav.map(({key,label,icon:Icon}) => <NavLink key={key} to={`/portal/${key}`} onNavigate={() => { if (mobile) close(); setCurrent(key); }} aria-current={current === key ? 'page' : undefined}><Icon size={18} aria-hidden="true"/>{label}</NavLink>)}</nav>
    <div className="portal-account"><strong>{who}</strong><small>{roleLabel}</small><Button variant="ghost" icon={LogOut} onClick={() => { if (mobile) close(); onLogout(); }}>Sign out</Button></div>
  </>;
  return <div className="portal-shell">
    <a className="skip-link" href="#portal-content">Skip to content</a>
    <aside className="portal-sidebar">{sidebar(false)}</aside>
    <dialog className="portal-drawer" ref={drawer} aria-label="Portal navigation menu" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}><div className="portal-sidebar is-open">{sidebar(true)}</div></dialog>
    <div className="portal-workspace"><header className="portal-header"><div className="portal-header__context">Your workspace<h1>{nav.find(item => item.key === current)?.label || 'Dashboard'}</h1></div><span className="portal-header__context portal-header__role">{roleLabel} portal</span><button type="button" ref={trigger} className="button button--ghost portal-mobile-toggle" aria-label="Open portal navigation" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={20}/></button></header>
      <main id="portal-content" className="portal-content" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
