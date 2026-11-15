import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { Button, Field, tokens } from '../ui';
import { ROLE_LABEL } from '../config/roles';
import { getMyTutorProfile, saveMyProfile } from '../services/supabaseData';

export default function ProfileSettings({ saveProfile = saveMyProfile, loadTutor = getMyTutorProfile }) {
  const { user, profile, refreshProfile } = useAuth();
  const [name,setName] = useState(profile?.full_name?.trim() || '');
  const [phone,setPhone] = useState(profile?.phone || '');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [success,setSuccess] = useState('');
  const [tutor,setTutor] = useState(null);
  const [tutorError,setTutorError] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (profile?.role === 'tutor') loadTutor(user.id).then(({data,error}) => {
      if (!cancelled) { setTutor(data); setTutorError(error ? 'Unable to load teaching details. Please reload this page.' : ''); }
    }).catch(() => { if (!cancelled) setTutorError('Unable to load teaching details. Please reload this page.'); });
    return () => { cancelled = true; };
  }, [user.id,profile?.role,loadTutor]);
  const save = async event => {
    event.preventDefault(); setError(''); setSuccess('');
    if (!name.trim()) { setError('Enter your full name.'); return; }
    setBusy(true);
    try {
      const result = await saveProfile({full_name:name,phone});
      if (result.error) { setError(result.error.message); return; }
      setSuccess('Your profile has been saved.');
      await refreshProfile?.();
    } catch { setError('Unable to save your profile. Your changes are still here; please try again.'); }
    finally { setBusy(false); }
  };
  const card = {background:tokens.cardBg,border:`1px solid ${tokens.line}`,borderRadius:16,padding:24,marginBottom:20};
  return <section style={{maxWidth:760}}>
    <h2 style={{fontFamily:'Fraunces, serif',marginTop:0}}>Profile Settings</h2>
    <form onSubmit={save} style={card}>
      <h3 style={{marginTop:0}}>Personal details</h3>
      <Field label="Full name" required><input autoComplete="name" value={name} maxLength={160} onChange={event => setName(event.target.value)} /></Field>
      <Field label="Phone"><input type="tel" autoComplete="tel" maxLength={40} value={phone} onChange={event => setPhone(event.target.value)} /></Field>
      <Field label="Email"><input type="email" value={profile?.email || user.email || ''} readOnly /></Field>
      <div className="responsive-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
        <Field label="Account role"><input value={ROLE_LABEL[profile?.role] || profile?.role || ''} readOnly /></Field>
        <Field label="Account status"><input value={profile?.status || ''} readOnly /></Field>
      </div>
      {error && <p role="alert" style={{color:tokens.danger}}>{error}</p>}
      {success && <p role="status" style={{color:tokens.success}}>{success}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
    </form>
    {profile?.role === 'tutor' && <div style={card}>
      <h3 style={{marginTop:0}}>Teaching profile</h3>
      {tutorError ? <p role="alert">{tutorError}</p> : !tutor ? <p>Loading teaching details…</p> : <>
        <dl style={{display:'grid',gridTemplateColumns:'minmax(100px,1fr) 2fr',gap:14,marginBottom:20}}>
          <dt>Tutor name</dt><dd style={{margin:0}}>{tutor.full_name}</dd>
          <dt>Subjects</dt><dd style={{margin:0}}>{tutor.subjects?.join(', ') || 'Not specified'}</dd>
          <dt>Curriculum</dt><dd style={{margin:0}}>{tutor.curriculum?.join(', ') || 'Not specified'}</dd>
          <dt>Biography</dt><dd style={{margin:0,whiteSpace:'pre-wrap'}}>{tutor.bio || 'Not specified'}</dd>
        </dl>
        <p style={{fontSize:13,color:tokens.slate}}>Contact LearnWise to update your teaching profile.</p>
      </>}
    </div>}
  </section>;
}
