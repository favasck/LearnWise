import React, { useId, useRef, useState } from 'react';
import { Eye, EyeOff, GraduationCap, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { Button, Field } from '../../ui';
import { NavLink } from '../navigation';

export function AuthShell({ title, subtitle, children, footer }) {
  return <main className="auth-layout" tabIndex={-1}><div className="auth-panel">
    <a className="brand" href="/" aria-label="LearnWise Academy home"><span className="brand__mark"><GraduationCap size={22}/></span><span><span className="brand__name">LearnWise</span><span className="brand__sub">Academy</span></span></a>
    <section className="flow-card"><h1>{title}</h1>{subtitle && <p className="flow-card__description">{subtitle}</p>}{children}</section>{footer}
    <p className="auth-footer"><a href="/">← Back to LearnWise</a></p>
  </div></main>;
}
function PasswordField({ label='Password', value, onChange, autoComplete='current-password', minLength, hint }) {
  const [visible,setVisible] = useState(false);
  const id = useId();
  return <div className="field"><label htmlFor={id}>{label}</label><div className="password-control"><input id={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} required minLength={minLength} autoComplete={autoComplete} aria-describedby={hint ? `${id}-hint` : undefined}/><button type="button" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{hint && <p className="field__hint" id={`${id}-hint`}>{hint}</p>}</div>;
}
export function SignIn({ onGoSignUp, onGoStaff, onForgot, staff=false, onBack }) {
  const {signIn} = useAuth();
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const inFlight = useRef(false);
  const submit = async event => {
    event.preventDefault(); if (inFlight.current) return;
    inFlight.current = true; setLoading(true); setError('');
    try { const {error} = await signIn({email:email.trim(),password}); if (error) setError('We couldn’t sign you in. Check your email and password, or try again shortly.'); }
    catch { setError('We couldn’t sign you in. Please try again shortly.'); }
    finally { inFlight.current = false; setLoading(false); }
  };
  return <AuthShell title={staff ? 'Staff sign in' : 'Welcome back.'} subtitle={staff ? 'Sign in with your LearnWise staff account.' : 'Your next step in learning starts here.'} footer={<div className="auth-footer">{staff ? <NavLink to="/login" onNavigate={onBack}>Back to student & parent sign in</NavLink> : <>New to LearnWise? <NavLink to="/signup" onNavigate={onGoSignUp}>Create an account</NavLink><br/><NavLink to="/staff/login" onNavigate={onGoStaff}>Staff sign in</NavLink></>}</div>}>
    <form onSubmit={submit} aria-busy={loading}>{error && <div className="form-notice" role="alert">{error}</div>}<Field label="Email address" required><input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)}/></Field><PasswordField value={password} onChange={event => setPassword(event.target.value)}/><div style={{textAlign:'right',fontSize:12,marginBottom:22}}><NavLink to="/forgot-password" onNavigate={onForgot}>Forgot password?</NavLink></div><Button type="submit" disabled={loading} style={{width:'100%'}}>{loading ? 'Signing in…' : 'Sign in'}</Button></form>
  </AuthShell>;
}
export function SignUp({ onGoSignIn }) {
  const {signUp} = useAuth();
  const [form,setForm] = useState({fullName:'',email:'',password:'',role:'student'});
  const [state,setState] = useState('idle');
  const inFlight = useRef(false);
  const change = (key,value) => setForm(previous => ({...previous,[key]:value}));
  const submit = async event => {
    event.preventDefault(); if (inFlight.current) return;
    inFlight.current = true; setState('saving');
    try { const {error} = await signUp({...form,fullName:form.fullName.trim(),email:form.email.trim()}); setState(error ? 'error' : 'done'); }
    catch { setState('error'); }
    finally { inFlight.current = false; }
  };
  if (state === 'done') return <AuthShell title="Check your inbox." subtitle={`Look for a confirmation email at ${form.email}.`}><p className="flow-card__description">Confirm your email, then sign in. Our team will link your account to the right learning profile.</p><NavLink to="/login" onNavigate={onGoSignIn} className="button button--primary">Back to sign in</NavLink></AuthShell>;
  return <AuthShell title="A new chapter starts here." subtitle="Create your LearnWise account." footer={<p className="auth-footer">Already have an account? <NavLink to="/login" onNavigate={onGoSignIn}>Sign in</NavLink></p>}>
    <form onSubmit={submit} aria-busy={state === 'saving'}>{state === 'error' && <div className="form-notice" role="alert">We couldn’t create your account. Please check your details and try again.</div>}
      <fieldset className="choice-group"><legend>I’m joining as a</legend><div className="choices">{['student','parent','tutor'].map(role => <label className="choice" key={role}><input type="radio" name="account-role" value={role} checked={form.role === role} onChange={() => change('role',role)}/><span>{role[0].toUpperCase()+role.slice(1)}</span></label>)}</div></fieldset>
      <Field label="Full name" required><input required autoComplete="name" value={form.fullName} onChange={event => change('fullName',event.target.value)}/></Field><Field label="Email address" required><input required type="email" autoComplete="email" value={form.email} onChange={event => change('email',event.target.value)}/></Field><PasswordField value={form.password} onChange={event => change('password',event.target.value)} minLength={6} autoComplete="new-password" hint="Use at least 6 characters."/>
      <p className="field__hint" style={{marginBottom:20}}>After email confirmation, our team will connect you to your student, parent, or tutor profile.</p><Button type="submit" disabled={state === 'saving'} style={{width:'100%'}}>{state === 'saving' ? 'Creating account…' : 'Create account'}</Button>
    </form>
  </AuthShell>;
}
export function ForgotPassword({ onSignIn }) {
  const {requestPasswordReset} = useAuth();
  const [email,setEmail] = useState('');
  const [state,setState] = useState('idle');
  const inFlight = useRef(false);
  const submit = async event => {
    event.preventDefault(); if (inFlight.current) return;
    inFlight.current = true; setState('saving');
    try { const {error} = await requestPasswordReset(email); setState(error ? 'error' : 'done'); }
    catch { setState('error'); }
    finally { inFlight.current = false; }
  };
  return <AuthShell title={state === 'done' ? 'Check your inbox.' : 'Let’s get you back in.'} subtitle={state === 'done' ? 'If an account exists for this email, you’ll receive a password reset link.' : 'Enter your account email and we’ll send you a reset link.'} footer={<p className="auth-footer"><NavLink to="/login" onNavigate={onSignIn}>Back to sign in</NavLink></p>}>
    {state === 'done' ? <p className="flow-card__description" role="status">Check your spam folder too. Open the link in your email to choose a new password.</p> : <form onSubmit={submit} aria-busy={state === 'saving'}>{state === 'error' && <div role="alert" className="form-notice">We couldn’t send the reset link. Please try again shortly.</div>}<Field label="Email address" required><input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)}/></Field><Button type="submit" disabled={state === 'saving'} style={{width:'100%'}}>{state === 'saving' ? 'Sending…' : 'Send reset link'}</Button></form>}
  </AuthShell>;
}
export function ResetPassword({ ready, loading, onRequest, onFinish }) {
  const {updatePassword} = useAuth();
  const [password,setPassword] = useState('');
  const [confirmation,setConfirmation] = useState('');
  const [state,setState] = useState('idle');
  const [error,setError] = useState('');
  const inFlight = useRef(false);
  const submit = async event => {
    event.preventDefault(); if (inFlight.current) return;
    if (password !== confirmation) { setError('Your passwords don’t match. Please check them.'); return; }
    inFlight.current = true; setState('saving'); setError('');
    try { const {error} = await updatePassword(password); if (error) { setError('We couldn’t update your password. Try again, or request a new reset link.'); setState('idle'); } else setState('done'); }
    catch { setError('We couldn’t update your password. Please try again.'); setState('idle'); }
    finally { inFlight.current = false; }
  };
  if (state === 'done') return <AuthShell title="Your password is updated." subtitle="You can now sign in with your new password."><Button onClick={onFinish} style={{width:'100%'}}>Back to sign in</Button></AuthShell>;
  if (loading && !ready) return <AuthShell title="Checking your reset link…" subtitle="Please wait a moment."/>;
  if (!ready) return <AuthShell title="Let’s get a fresh link." subtitle="This reset link is missing, expired, or has already been used."><NavLink to="/forgot-password" onNavigate={onRequest} className="button button--primary">Request a new reset link</NavLink></AuthShell>;
  return <AuthShell title="Choose a new password." subtitle="Make it something unique to your LearnWise account."><form onSubmit={submit} aria-busy={state === 'saving'}>{error && <div role="alert" className="form-notice">{error}</div>}<PasswordField label="New password" value={password} onChange={event => setPassword(event.target.value)} minLength={6} autoComplete="new-password" hint="Use at least 6 characters."/><PasswordField label="Confirm new password" value={confirmation} onChange={event => setConfirmation(event.target.value)} minLength={6} autoComplete="new-password"/><Button type="submit" disabled={state === 'saving'} style={{width:'100%'}}>{state === 'saving' ? 'Updating password…' : 'Update password'}</Button></form></AuthShell>;
}
