import React, {useEffect,useRef} from 'react';
import { CalendarDays, Video } from 'lucide-react';
import { Button } from '../ui';
import {useDetailRoute} from './navigation';
import { lessonTime, safeMeetingUrl } from './experience';

export default function LessonList({lessons=[],showStudent=false}) {
  const [selectedId,open,close]=useDetailRoute('lesson');
  const selected=lessons.find(lesson=>lesson.id===selectedId);
  const heading=useRef(null);
  useEffect(()=>{if(selectedId){heading.current?.focus({preventScroll:true});window.scrollTo?.({top:0,behavior:'instant'});}},[selectedId]);
  const meeting=selected?.mode==='Online'&&safeMeetingUrl(selected.meeting_link);
  if(selectedId&&!selected)return <section className="lesson-detail-page"><h2 ref={heading} tabIndex={-1}>Lesson unavailable in this view</h2><p>The lesson may have changed, or your current filters may exclude it. Return to the list to check.</p><Button variant="ghost" onClick={close}>Back to lessons</Button></section>;
  return <>
    {!selected&&<ul className="lesson-list" aria-label="Lessons">{lessons.map(lesson=><li key={lesson.id}>
      <div className="lesson-list__subject"><CalendarDays size={20} aria-hidden="true"/><div><strong>{lesson.subject||'Lesson'}</strong>{showStudent&&<span>{lesson.student?.full_name||'Student'}</span>}<span>{lesson.topic||'Topic to be discussed'}</span></div></div>
      <div><strong>{lessonTime(lesson.scheduled_at)}</strong><span>Qatar time · {lesson.duration_min?`${lesson.duration_min} min`:'Duration to be confirmed'}</span></div>
      <div><strong>{lesson.status||'Status unavailable'}</strong><span>{lesson.tutor?.full_name||'Tutor to be confirmed'} · {lesson.mode==='Online'?'Online':'In person'}</span></div>
      <button className="button button--secondary" type="button" onClick={()=>open(lesson.id)} aria-label={`View ${lesson.subject||'lesson'} details on ${lessonTime(lesson.scheduled_at)}`}>Lesson details</button>
    </li>)}</ul>}
    {selected&&<article className="lesson-detail-page" aria-label="Lesson details"><Button variant="ghost" onClick={close}>← Back to lessons</Button><h2 ref={heading} tabIndex={-1}>{selected.subject||'Lesson details'}</h2>
      <p className="experience-explainer">{lessonTime(selected.scheduled_at)} · Qatar time</p>
      <dl className="review">{[
        ['Status',selected.status||'Not specified'],
        ...(showStudent?[['Student',selected.student?.full_name||'Not specified']]:[]),
        ['Tutor',selected.tutor?.full_name||'To be confirmed'],
        ['Topic',selected.topic||'Discuss your priorities with your tutor'],
        ['Duration',selected.duration_min?`${selected.duration_min} minutes`:'To be confirmed'],
        ['Format',selected.mode==='Online'?'Online':'In person'],
        ['Attendance',selected.attendance||'Not recorded yet'],
        ...(selected.location?[['Location',selected.location]]:[]),
      ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {selected.status==='Scheduled'&&<><h3>Before your lesson</h3><p className="experience-explainer">Have your notes, recent homework and questions ready. For online lessons, check your connection, microphone and camera.</p>{meeting?<a className="button button--primary" href={meeting} target="_blank" rel="noreferrer"><Video size={16} aria-hidden="true"/>Open lesson link<span className="sr-only"> (opens a new tab)</span></a>:selected.mode==='Online'&&<p>The lesson link is not available yet. Contact the academy if your lesson is about to start.</p>}</>}
      {selected.status==='Completed'&&<p className="experience-explainer">Look in Progress for shared tutor feedback and Homework for your next practice task.</p>}
    </article>}
  </>;
}
