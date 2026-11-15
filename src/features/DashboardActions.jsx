import React from 'react';
import { ArrowRight, CalendarDays, Video } from 'lucide-react';
import { NavLink } from './navigation';
import { lessonTime, nextLesson, safeMeetingUrl } from './experience';

export function PortalAction({section,onNavigate,children,primary=false}) {
  return <NavLink to={`/portal/${section}`} onNavigate={()=>onNavigate(section)} className={`button ${primary?'button--primary':'button--ghost'}`}>{children}<ArrowRight size={16} aria-hidden="true"/></NavLink>;
}
export function DashboardActions({title,description,actions=[],onNavigate}) {
  return <section className="dashboard-actions" aria-label="Your next steps"><div><span className="eyebrow">Your next step</span><h2>{title}</h2><p>{description}</p></div><div className="dashboard-actions__links">{actions.map((action,i)=><PortalAction key={action.section} section={action.section} onNavigate={onNavigate} primary={i===0}>{action.label}</PortalAction>)}</div></section>;
}
export function NextLesson({classes,onNavigate,section='myclasses'}) {
  const lesson = nextLesson(classes);
  const meeting = lesson?.mode==='Online' && safeMeetingUrl(lesson.meeting_link);
  return <section className="next-lesson" aria-label="Next lesson"><div className="next-lesson__icon"><CalendarDays size={24} aria-hidden="true"/></div><div className="next-lesson__body"><span className="eyebrow">{lesson?'Coming up':'Your lessons'}</span><h2>{lesson ? lesson.subject || 'Your next lesson' : 'Make room for your next step'}</h2><p>{lesson ? `${lessonTime(lesson.scheduled_at)} · Qatar time` : 'No upcoming lesson is scheduled. View your lessons or request a suitable time.'}</p>{lesson&&<p>{[lesson.student?.full_name,lesson.tutor?.full_name,lesson.topic,lesson.mode==='Online'?'Online':lesson.location||'In person'].filter(Boolean).join(' · ')}</p>}</div><div className="next-lesson__actions">{meeting&&<a className="button button--primary" href={meeting} target="_blank" rel="noreferrer"><Video size={16} aria-hidden="true"/>Open lesson link<span className="sr-only"> (opens a new tab)</span></a>}<PortalAction section={section} onNavigate={onNavigate}>{lesson?'View lessons':'Plan a lesson'}</PortalAction></div></section>;
}
