import React from 'react';
import {BookOpen,Clock} from 'lucide-react';
import {homeworkOrder} from './experience';

const dueDate=value=>value&&!Number.isNaN(Date.parse(value))?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Qatar',day:'numeric',month:'short',year:'numeric'}).format(new Date(value)):'No due date set';
export default function HomeworkCards({items,showStudent=false}){
  return <div className="homework-cards" aria-label="Homework tasks">{homeworkOrder(items).map(item=><article className="homework-task" key={item.id}><div className="homework-task-heading"><BookOpen size={20} aria-hidden="true"/><h3>{item.title}</h3><span className="homework-status">{item.status||'Status unavailable'}</span></div>{showStudent&&<p className="homework-learner">{item.student?.full_name||'Learner'}</p>}<p className="homework-deadline"><Clock size={15} aria-hidden="true"/>Due: {dueDate(item.due_at)} · Qatar time</p><p className="homework-tutor">Tutor: {item.tutor?.full_name||'Not specified'}</p>{item.description&&<div className="homework-instructions"><h4>What to do</h4><p>{item.description}</p></div>}{item.tutor_feedback&&<div className="homework-feedback"><h4>Tutor feedback</h4><p>{item.tutor_feedback}</p></div>}</article>)}</div>;
}
