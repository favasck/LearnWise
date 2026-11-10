import React, { useState } from 'react';
import { ArrowRight, BookOpen, Check, FileText, GraduationCap, Search, Target, TrendingUp, Users, Video } from 'lucide-react';
import { NavLink } from './navigation';
import { Button } from '../ui';

export const subjectDetails = [
  ['Mathematics','Build understanding in algebra, geometry, calculus, and statistics. Practise explaining the steps as well as finding the answer.'],
  ['Physics','Connect forces, electricity, waves, and other concepts to the questions you meet in class and in exams.'],
  ['Chemistry','Make sense of reactions, structures, and calculations with explanations and practice tailored to the topic.'],
  ['Biology','Explore cells, genetics, ecology, and human physiology while developing clear scientific explanations.'],
  ['English','Develop comprehension, literary analysis, grammar, and confident written expression.'],
  ['Computer Science','Work through programming, algorithms, data structures, and the reasoning behind them.'],
  ['Economics','Connect economic ideas to data, examples, and well-structured answers.'],
  ['History','Strengthen source analysis, essay structure, and your understanding of historical themes.'],
  ['Geography','Develop knowledge of human and physical geography, case studies, and geographical skills.'],
];
function PageHero({ eyebrow,title,description }) {
  return <section className="page-hero"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></section>;
}
function AssessmentCallout({ onNav }) {
  return <section className="home-section"><div className="assessment-banner"><div><h2>Not sure where to start?</h2><p>Tell us about the learner, their curriculum, and what feels difficult. We’ll discuss suitable support with you.</p></div><NavLink to="/assessment" onNavigate={() => onNav('assessment')} className="button">Request a free assessment <ArrowRight size={17}/></NavLink></div></section>;
}
export function PublicAbout({ onNav }) {
  return <><PageHero eyebrow="About LearnWise" title={<>Personal attention.<br/><em>Purposeful learning.</em></>} description="One-to-one tutoring in Doha and online, shaped around the learner’s goals, curriculum, and pace."/>
    <section className="home-section page-split"><div><div className="eyebrow">Our purpose</div><h2>Make the next step<br/>feel possible.</h2></div><div className="page-prose"><p>A difficult topic can affect more than a mark. It can change how a student feels about learning. Our approach starts with understanding where they need support.</p><p>We focus on clear explanations, useful practice, and feedback that gives students something concrete to work on next.</p></div></section>
    <section className="home-section" style={{paddingTop:0}}><div className="approach-grid">{[[Users,'One-to-one attention','Time to ask questions, revisit an explanation, and practise at a comfortable pace.'],[Target,'A clear direction','Support shaped around the learner’s subjects, curriculum, and academic goals.'],[TrendingUp,'Connected support','Class notes, homework, and tutor feedback help keep learning connected between lessons.']].map(([Icon,title,description]) => <article className="approach-card" key={title}><Icon size={23} color="#2C5F63"/><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <AssessmentCallout onNav={onNav}/></>;
}
export function PublicSubjects({ onNav, initialSubject='' }) {
  const [query,setQuery] = useState(initialSubject);
  const subjects = subjectDetails.filter(([name]) => name.toLowerCase().includes(query.toLowerCase().trim()));
  return <><PageHero eyebrow="Find your focus" title={<>Subjects for every<br/><em>next step.</em></>} description="Explore one-to-one support for school learning and exam preparation. We’ll discuss the right level and curriculum for your needs."/>
    <section className="home-section" style={{paddingTop:12}}><div className="subject-search"><label htmlFor="subject-search">Find a subject</label><div><Search size={18} aria-hidden="true"/><input id="subject-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search mathematics, English…"/></div><p role="status">{subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'} found</p></div>
      <div className="subject-detail-grid">{subjects.map(([name,description]) => <article className="subject-detail" key={name}><span className="subject-card__icon"><BookOpen size={21}/></span><h2>{name}</h2><p>{description}</p><NavLink to={`/assessment?subject=${encodeURIComponent(name)}`} onNavigate={() => onNav('assessment',{subject:name})}>Explore support <ArrowRight size={15}/></NavLink></article>)}</div>
      {!subjects.length && <div className="flow-card"><h2>No matching subjects.</h2><p className="flow-card__description">Try a different name, or contact us to discuss the support you’re looking for.</p><Button variant="secondary" onClick={() => setQuery('')}>Show all subjects</Button></div>}
    </section><AssessmentCallout onNav={onNav}/></>;
}
export function PublicIGCSE({ onNav }) {
  const curricula = [['Cambridge IGCSE','Build subject understanding and practise applying it to exam-style questions.'],['Pearson Edexcel','Focused support for the topics and question formats in your International GCSE course.'],['Cambridge A-Level','Work through AS and A2 concepts with structured practice and feedback.'],['IB Programme','Discuss support for your MYP or Diploma Programme subjects and learning goals.'],['School curriculum','Bring the topics and questions you’re working on in school. We’ll help identify a useful starting point.']];
  return <><PageHero eyebrow="Curriculum & exam support" title={<>Understand the topic.<br/><em>Approach the exam.</em></>} description="Support for IGCSE, Edexcel, A-Level, IB, and school curricula. Share your course and exam board so we can discuss suitable tuition."/>
    <section className="home-section" style={{paddingTop:12}}><div className="subject-detail-grid">{curricula.map(([name,description]) => <article className="subject-detail" key={name}><span className="subject-card__icon"><GraduationCap size={22}/></span><h2>{name}</h2><p>{description}</p></article>)}</div></section>
    <section className="home-section page-split" style={{paddingTop:0}}><div><div className="eyebrow">A purposeful approach</div><h2>Prepare with<br/>a clearer plan.</h2></div><ul className="learning-checklist">{['Identify topics that need more attention.','Practise explaining your working and reasoning.','Use exam-style questions to apply what you know.','Review feedback and decide what to practise next.'].map(item => <li key={item}><Check size={17}/>{item}</li>)}</ul></section><AssessmentCallout onNav={onNav}/></>;
}
export function PublicOnline({ onNav }) {
  return <><PageHero eyebrow="Online tuition" title={<>A personal connection.<br/><em>Wherever you learn.</em></>} description="One-to-one lessons over video call, with the flexibility to learn from a familiar place."/>
    <section className="home-section" style={{paddingTop:12}}><div className="approach-grid">{[[Video,'Meet your tutor','Use the meeting link provided for your scheduled lesson. Your tutor can explain any setup you need.'],[FileText,'Work through it together','Ask questions, follow explanations, and work through examples with your tutor.'],[BookOpen,'Keep learning connected','Find assigned homework, available materials, and shared feedback in your portal.']].map(([Icon,title,description]) => <article className="approach-card" key={title}><Icon size={24} color="#2C5F63"/><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <section className="home-section page-split" style={{paddingTop:0}}><div><div className="eyebrow">Before your lesson</div><h2>A little preparation.<br/>More time to learn.</h2></div><ul className="learning-checklist">{['Choose a quiet space and check your internet connection.','Have your notes, questions, and course materials nearby.','Test your microphone and camera before joining.','Let your tutor know which topic you’d like to focus on.'].map(item => <li key={item}><Check size={17}/>{item}</li>)}</ul></section><AssessmentCallout onNav={onNav}/></>;
}
