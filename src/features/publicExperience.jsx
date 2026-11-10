import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, Clock, GraduationCap, Menu, Target, TrendingUp, Users, Video, X } from 'lucide-react';
import { Button, Field } from '../ui';
import { NavLink, publicPaths } from './navigation';
import * as db from '../services/supabaseData';

const SUBJECTS = ['Mathematics','Physics','Chemistry','Biology','English','Computer Science','Economics','History','Geography'];
const CURRICULA = ['IGCSE','Edexcel','Cambridge','School Curriculum','A-Level','IB'];
const links = [['home','Home'],['about','About'],['subjects','Subjects'],['igcse','IGCSE / Edexcel'],['online','Online Tuition'],['contact','Contact']];

export function Brand({ onNav }) {
  return <NavLink to="/" onNavigate={() => onNav('home')} className="brand" aria-label="LearnWise Academy home">
    <span className="brand__mark"><GraduationCap size={22} aria-hidden="true"/></span>
    <span><span className="brand__name">LearnWise</span><span className="brand__sub">Academy</span></span>
  </NavLink>;
}
export function PublicNav({ current, onNav }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef(null);
  const navigation = useRef(null);
  const navigate = screen => { setOpen(false); onNav(screen); };
  useEffect(() => { setOpen(false); }, [current]);
  useEffect(() => {
    if (!open) return;
    const escape = event => { if (event.key === 'Escape') { setOpen(false); toggle.current?.focus(); } };
    const outside = event => { if (!navigation.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside); };
  }, [open]);
  return <header className="public-nav" ref={navigation}>
    <div className="public-nav__inner"><Brand onNav={navigate}/>
      <button ref={toggle} type="button" className="button button--ghost public-nav__toggle" aria-expanded={open} aria-controls="public-navigation" aria-label={open ? 'Close navigation' : 'Open navigation'} onClick={() => setOpen(!open)}>{open ? <X size={20}/> : <Menu size={20}/>}</button>
      <nav id="public-navigation" aria-label="Main navigation" className={`public-nav__links ${open ? 'is-open' : ''}`}>
        {links.map(([key,label]) => <NavLink key={key} to={publicPaths[key]} onNavigate={() => navigate(key)} className="public-nav__link" aria-current={current === key ? 'page' : undefined}>{label}</NavLink>)}
        <div className="public-nav__actions">
          <NavLink to="/login" onNavigate={() => navigate('signin')} className="button button--ghost">Login</NavLink>
          <NavLink to="/assessment" onNavigate={() => navigate('assessment')} className="button button--primary" aria-current={current === 'assessment' ? 'page' : undefined}>Book Assessment</NavLink>
        </div>
      </nav>
    </div>
  </header>;
}
export function PublicFooter({ onNav }) {
  return <footer className="public-footer"><div className="public-footer__inner">
    <div><Brand onNav={onNav}/><p>Smart Guidance. Better Learning.<br/>Personalised one-to-one tuition in Doha and online, built around each learner.</p></div>
    <div><h2>Explore LearnWise</h2><div className="public-footer__links">{links.slice(1).map(([key,label]) => <NavLink key={key} to={publicPaths[key]} onNavigate={() => onNav(key)}>{label}</NavLink>)}</div></div>
    <div><h2>Your next step</h2><div className="public-footer__links"><NavLink to="/assessment" onNavigate={() => onNav('assessment')}>Request a free assessment</NavLink><NavLink to="/login" onNavigate={() => onNav('signin')}>Student & parent portal</NavLink><NavLink to="/staff/login" onNavigate={() => onNav('staff')}>Staff sign in</NavLink><a href="mailto:info@learnwiseacademy.qa">info@learnwiseacademy.qa</a><span>Doha, Qatar</span></div></div>
  </div><div className="public-footer__bottom"><span>© {new Date().getFullYear()} LearnWise Academy</span><span>One learner. A world of possibility.</span></div></footer>;
}
export function PublicHome({ onNav }) {
  const subjectIcons = [Target, TrendingUp, BookOpen, GraduationCap, BookOpen, Target, TrendingUp, BookOpen, GraduationCap];
  return <>
    <section className="hero" aria-labelledby="home-title">
      <div><div className="eyebrow">Smart Guidance. Better Learning.</div>
        <h1 id="home-title">A clearer path to <em>confident learning.</em></h1>
        <p className="hero__description">One-to-one tutoring that meets your child where they are. Build understanding, prepare for exams, and take the next step with confidence.</p>
        <div className="hero__actions"><NavLink to="/assessment" onNavigate={() => onNav('assessment')} className="button button--primary">Find your starting point <ArrowRight size={17}/></NavLink><NavLink to="/subjects" onNavigate={() => onNav('subjects')} className="button button--ghost">Explore subjects</NavLink></div>
        <div className="hero__meta"><span><Check size={14}/> Free assessment</span><span><Video size={14}/> Online & in Doha</span></div>
      </div>
      <div className="learning-path"><div className="learning-path__label">The LearnWise approach</div><h2 className="learning-path__title">Small steps.<br/>Meaningful progress.</h2>
        {[['Understand','Start with your goals, curriculum, and areas that need a little more support.'],['Learn together','Work one-to-one with a tutor, at a pace that makes sense for you.'],['Build confidence','Keep practising, get useful feedback, and see what to focus on next.']].map(([title,description],index) => <div className="path-step" key={title}><span className="path-step__number">0{index+1}</span><div><h3>{title}</h3><p>{description}</p></div></div>)}
        <div className="path-note"><BookOpen size={22}/><span>Personal attention.<br/><strong>A plan built around your child.</strong></span></div>
      </div>
    </section>
    <div className="curriculum-strip"><span>Support for your curriculum</span>{['IGCSE','Edexcel','Cambridge','A-Level','IB','School Curriculum'].map(name => <strong key={name}>{name}</strong>)}</div>
    <section className="home-section"><div className="home-section__heading"><div><div className="eyebrow">Room to grow</div><h2>The right support,<br/>in the subjects that matter.</h2></div><p>From a difficult topic to an upcoming exam, find focused support for the next stage of learning.</p></div>
      <div className="subject-grid">{SUBJECTS.map((subject,index) => { const Icon = subjectIcons[index]; return <NavLink key={subject} to={`/subjects?subject=${encodeURIComponent(subject)}`} onNavigate={() => onNav('subjects',{subject})} className="subject-card"><span className="subject-card__icon"><Icon size={20}/></span><span><strong>{subject}</strong><small>One-to-one tuition</small></span><ChevronRight size={16}/></NavLink>; })}</div>
    </section>
    <section className="home-section home-section--approach"><div className="home-section__heading"><div><div className="eyebrow">More than a lesson</div><h2>Support that stays connected.</h2></div></div><div className="approach-grid">
      {[[Users,'A learner, not a number','Sessions shaped around individual goals, learning pace, and the topics that need attention.'],[Target,'Purposeful practice','Exam preparation and homework that help turn an explanation into lasting understanding.'],[TrendingUp,'A clearer picture','Tutor feedback and learning notes help students and parents understand what comes next.']].map(([Icon,title,description]) => <article className="approach-card" key={title}><Icon size={22} color="#2C5F63"/><h3>{title}</h3><p>{description}</p></article>)}
    </div></section>
    <section className="home-section" style={{paddingTop:0}}><div className="assessment-banner"><div><h2>Start with a conversation.</h2><p>Tell us what your child needs. We’ll help you explore the next step with a free assessment request.</p></div><NavLink to="/assessment" onNavigate={() => onNav('assessment')} className="button">Request a free assessment <ArrowRight size={17}/></NavLink></div></section>
  </>;
}

const blankAssessment = { parent_name:'', student_name:'', student_grade:'', curriculum:'', subjects:[], phone:'', parent_email:'', message:'', preferred_mode:'Online' };
const emailValid = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export function validateAssessment(form, step) {
  const errors = {};
  if (step === 0) {
    if (!form.student_name.trim()) errors.student_name = 'Enter the student’s name.';
    if (!form.subjects.length) errors.subjects = 'Choose at least one subject.';
  }
  if (step === 1) {
    if (!form.parent_name.trim()) errors.parent_name = 'Enter the parent or guardian’s name.';
    if (!emailValid(form.parent_email)) errors.parent_email = 'Enter a valid email address.';
  }
  return errors;
}
export function PublicAssessment({ submitRequest = db.submitAssessmentRequest, initialSubject='' }) {
  const [form,setForm] = useState(() => ({...blankAssessment,subjects:SUBJECTS.includes(initialSubject) ? [initialSubject] : []}));
  const [step,setStep] = useState(0);
  const [errors,setErrors] = useState({});
  const [err,setErr] = useState('');
  const [saving,setSaving] = useState(false);
  const [done,setDone] = useState(false);
  const heading = useRef(null);
  const container = useRef(null);
  const inFlight = useRef(false);
  useEffect(() => { heading.current?.focus(); }, [step,done]);
  const change = (key,value) => { setForm(previous => ({...previous,[key]:value})); setErrors(previous => ({...previous,[key]:undefined})); };
  const next = event => {
    event.preventDefault();
    const found = validateAssessment(form,step);
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => container.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    setStep(step + 1);
  };
  const submit = async event => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setSaving(true); setErr('');
    try {
      const { error } = await submitRequest({ ...form, parent_name:form.parent_name.trim(), student_name:form.student_name.trim(), parent_email:form.parent_email.trim(), parent_phone:form.phone.trim(), phone:undefined, curriculum:form.curriculum || null, status:'New', submitted_at:new Date().toISOString() });
      if (error) setErr('We couldn’t send your request. Your details are still here. Please try again, or email info@learnwiseacademy.qa.');
      else setDone(true);
    } catch { setErr('We couldn’t send your request. Your details are still here. Please try again, or email info@learnwiseacademy.qa.'); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <div className="flow-layout"><aside className="flow-intro"><div className="eyebrow">A good place to start</div><h1>Let’s find their<br/>next step.</h1><p>Request a free assessment so we can understand your child’s learning needs and discuss suitable support.</p><div className="flow-intro__note"><strong>What happens next?</strong><p>Our team will contact you to discuss your request and arrange an assessment. Your appointment is confirmed once you agree a time together.</p><p><Check size={14}/> No payment needed to send a request.</p></div></aside>
    <section className="flow-card" ref={container} aria-label="Assessment request">
      {done ? <><div className="success-mark"><CheckCircle2 size={28}/></div><h2 ref={heading} tabIndex={-1}>Your request is with us.</h2><p className="flow-card__description">Thank you, {form.parent_name}. Our team will contact you at <strong>{form.parent_email}</strong> to arrange an assessment for {form.student_name}.</p><div className="path-note"><Clock size={20}/><span>This is an assessment request. We’ll agree a date and time with you before your appointment is confirmed.</span></div><p className="flow-card__description" style={{marginTop:24}}>Need to add anything? <a href="mailto:info@learnwiseacademy.qa">Email our team</a>.</p></> : <>
        <ol className="flow-steps" aria-label="Request progress">{['Learning needs','Your details','Review & send'].map((label,index) => <li key={label} aria-current={step === index ? 'step' : undefined}><span>{index < step ? <Check size={13}/> : index + 1}</span>{label}</li>)}</ol>
        <h2 ref={heading} tabIndex={-1}>{['Tell us about the learner','How can we reach you?','Does everything look right?'][step]}</h2>
        <p className="flow-card__description">{['Start with the subjects where a little support could make a difference.','We’ll use these details to follow up on your assessment request.','Check your details, then send your request to the LearnWise team.'][step]}</p>
        {err && <div className="form-notice" role="alert">{err}</div>}
        <form noValidate onSubmit={step === 2 ? submit : next} aria-busy={saving}>
          {step === 0 && <>
            <Field label="Student name" required error={errors.student_name}><input value={form.student_name} onChange={e => change('student_name',e.target.value)} autoComplete="off"/></Field>
            <div className="form-grid"><Field label="Grade / year (optional)"><input value={form.student_grade} onChange={e => change('student_grade',e.target.value)} placeholder="e.g. Year 10"/></Field><Field label="Curriculum (optional)"><select value={form.curriculum} onChange={e => change('curriculum',e.target.value)}><option value="">Not sure yet</option>{CURRICULA.map(value => <option key={value}>{value}</option>)}</select></Field></div>
            <fieldset className="choice-group"><legend>Subjects needing support <span aria-hidden="true">*</span></legend><div className="choices">{SUBJECTS.map(subject => <label key={subject} className="choice"><input type="checkbox" checked={form.subjects.includes(subject)} onChange={() => change('subjects',form.subjects.includes(subject) ? form.subjects.filter(value => value !== subject) : [...form.subjects,subject])} aria-invalid={!!errors.subjects || undefined} aria-describedby={errors.subjects ? 'subjects-error' : undefined}/><span>{subject}</span></label>)}</div>{errors.subjects && <p className="field__error" id="subjects-error">{errors.subjects}</p>}</fieldset>
            <Field label="Preferred lesson format"><select value={form.preferred_mode} onChange={e => change('preferred_mode',e.target.value)}>{['Online','In-Person','Either'].map(value => <option key={value}>{value}</option>)}</select></Field>
          </>}
          {step === 1 && <>
            <Field label="Parent / guardian name" required error={errors.parent_name}><input autoComplete="name" value={form.parent_name} onChange={e => change('parent_name',e.target.value)}/></Field>
            <Field label="Email address" required error={errors.parent_email}><input type="email" autoComplete="email" value={form.parent_email} onChange={e => change('parent_email',e.target.value)}/></Field>
            <Field label="Phone number (optional)"><input type="tel" autoComplete="tel" value={form.phone} onChange={e => change('phone',e.target.value)} placeholder="+974 …"/></Field>
            <Field label="Anything else to share? (optional)" hint="For example, an upcoming exam or a topic they find difficult."><textarea rows={3} value={form.message} onChange={e => change('message',e.target.value)}/></Field>
          </>}
          {step === 2 && <><dl className="review">{[['Student',form.student_name],['Grade',form.student_grade || 'Not specified'],['Curriculum',form.curriculum || 'To discuss'],['Subjects',form.subjects.join(', ')],['Format',form.preferred_mode],['Contact',form.parent_name],['Email',form.parent_email],['Phone',form.phone || 'Not provided'],...(form.message ? [['Message',form.message]] : [])].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="field__hint">We’ll use these details to respond to your enquiry and arrange suitable support.</p></>}
          <div className="flow-actions">{step > 0 && <Button variant="ghost" disabled={saving} onClick={() => { setErr(''); setStep(step - 1); }}>Back</Button>}<Button type="submit" disabled={saving}>{saving ? 'Sending request…' : step === 2 ? 'Send assessment request' : 'Continue'}{!saving && <ArrowRight size={16}/>}</Button></div>
        </form>
      </>}
    </section>
  </div>;
}

export function PublicContact({ submitRequest = db.submitAssessmentRequest }) {
  const [form,setForm] = useState({name:'',email:'',phone:'',message:''});
  const [errors,setErrors] = useState({});
  const [state,setState] = useState('idle');
  const container = useRef(null);
  const inFlight = useRef(false);
  const change = (key,value) => { setForm(previous => ({...previous,[key]:value})); setErrors(previous => ({...previous,[key]:undefined})); };
  const submit = async event => {
    event.preventDefault(); if (inFlight.current) return;
    const found = {};
    if (!form.name.trim()) found.name = 'Enter your name.';
    if (!emailValid(form.email)) found.email = 'Enter a valid email address.';
    if (!form.message.trim()) found.message = 'Tell us how we can help.';
    setErrors(found);
    if (Object.keys(found).length) { requestAnimationFrame(() => container.current?.querySelector('[aria-invalid="true"]')?.focus()); return; }
    inFlight.current = true; setState('saving');
    try {
      const {error} = await submitRequest({parent_name:form.name.trim(),student_name:'Contact enquiry',parent_email:form.email.trim(),parent_phone:form.phone.trim(),message:form.message.trim(),status:'New',submitted_at:new Date().toISOString()});
      setState(error ? 'error' : 'done');
    } catch { setState('error'); }
    finally { inFlight.current = false; }
  };
  useEffect(() => { if (state === 'done') container.current?.querySelector('h2')?.focus(); }, [state]);
  return <div className="flow-layout"><aside className="flow-intro"><div className="eyebrow">Let’s talk</div><h1>A little guidance<br/>starts here.</h1><p>Ask about subjects, lesson formats, or getting started with LearnWise. We’re happy to help.</p><p><a href="mailto:info@learnwiseacademy.qa">info@learnwiseacademy.qa</a><br/>Doha, Qatar</p></aside><section className="flow-card" ref={container}>
    {state === 'done' ? <><div className="success-mark"><CheckCircle2 size={28}/></div><h2 tabIndex={-1}>Thanks for getting in touch.</h2><p className="flow-card__description">Your message has been received. Our team will reply to {form.email}.</p></> : <><h2>How can we help?</h2><p className="flow-card__description">Send a message and our team will get back to you.</p>{state === 'error' && <div role="alert" className="form-notice">We couldn’t send your message. Your details are still here. Try again or email our team.</div>}<form noValidate onSubmit={submit} aria-busy={state === 'saving'}>
      <Field label="Name" required error={errors.name}><input autoComplete="name" value={form.name} onChange={e => change('name',e.target.value)}/></Field>
      <Field label="Email address" required error={errors.email}><input type="email" autoComplete="email" value={form.email} onChange={e => change('email',e.target.value)}/></Field>
      <Field label="Phone number (optional)"><input type="tel" autoComplete="tel" value={form.phone} onChange={e => change('phone',e.target.value)}/></Field>
      <Field label="Message" required error={errors.message}><textarea rows={4} value={form.message} onChange={e => change('message',e.target.value)}/></Field>
      <Button type="submit" disabled={state === 'saving'} style={{width:'100%'}}>{state === 'saving' ? 'Sending…' : 'Send message'}<ArrowRight size={16}/></Button>
    </form></>}
  </section></div>;
}
