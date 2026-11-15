import React, { useCallback, useEffect, useState } from 'react';
import { experienceLabels } from './experience';

export function useDetailRoute(key) {
  const read=()=>typeof window==='undefined'?'':new URLSearchParams(window.location.search).get(key)||'';
  const [id,setId]=useState(read);
  useEffect(()=>{const sync=()=>setId(read());window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[key]);
  const notify=()=>window.dispatchEvent(new window.PopStateEvent('popstate'));
  const open=id=>{const url=new URL(window.location.href);url.searchParams.set(key,id);window.history.pushState({...window.history.state,learnwiseDetail:{key,path:url.pathname}},'',url.pathname+url.search);setId(id);notify();};
  const close=()=>{const marker=window.history.state?.learnwiseDetail;if(marker?.key===key&&marker.path===window.location.pathname){window.history.back();return;}const url=new URL(window.location.href);url.searchParams.delete(key);window.history.replaceState(null,'',url.pathname+url.search);setId('');notify();};
  return [id,open,close];
}

// Only non-sensitive display choices belong in the URL, never form drafts.
export function useViewPreference(key, fallback, allowed) {
  const read = () => {
    if (typeof window === 'undefined') return fallback;
    const value = new URLSearchParams(window.location.search).get(key);
    return value && (!allowed || allowed.includes(value)) ? value : fallback;
  };
  const [value,setValue] = useState(read);
  useEffect(()=>{const update=()=>setValue(read());window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update);},[key,fallback]);
  const change = next => {
    if (allowed && !allowed.includes(next)) return;
    const url = new URL(window.location.href);
    if (next === fallback) url.searchParams.delete(key); else url.searchParams.set(key,next);
    window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
    setValue(next);
  };
  return [value,change];
}

export const publicPaths = {
  home:'/', about:'/about', subjects:'/subjects', igcse:'/igcse', online:'/online-tuition',
  assessment:'/assessment', contact:'/contact', signin:'/login', signup:'/signup', staff:'/staff/login',
  forgot:'/forgot-password', reset:'/reset-password',
  authlinkerror:'/auth/link-error',
};
export const pageLabels = { home:'Home', about:'About', subjects:'Subjects', igcse:'IGCSE / Edexcel', online:'Online Tuition', assessment:'Request an assessment', contact:'Contact', signin:'Sign in', signup:'Create an account', staff:'Staff sign in', forgot:'Reset password', reset:'Choose a password', authlinkerror:'Email link unavailable' };
export function readRoute(pathname = '/', search = '', hash = '') {
  const callback = new URLSearchParams(hash.replace(/^#/,''));
  if (callback.has('error') || callback.has('error_code')) return {screen:'authlinkerror',section:'dashboard',search};
  const path = pathname.replace(/\/+$/, '') || '/';
  const screen = Object.keys(publicPaths).find(key => publicPaths[key] === path);
  if (screen) return { screen, section:'dashboard', search };
  const portal = path.match(/^\/portal(?:\/([a-z]+))?$/);
  if (portal) return { screen:'signin', section:portal[1] || 'dashboard', portal:true, search };
  return { screen:'notfound', section:'dashboard', search };
}
export function useNavigation() {
  const [route, setRoute] = useState(() => typeof window === 'undefined' ? readRoute('/') : readRoute(window.location.pathname,window.location.search,window.location.hash));
  useEffect(() => {
    const pop = () => setRoute(readRoute(window.location.pathname,window.location.search,window.location.hash));
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const navigate = useCallback((path, replace = false) => {
    const target = new URL(path,window.location.origin);
    if (window.location.pathname + window.location.search + window.location.hash !== target.pathname + target.search) window.history[replace ? 'replaceState' : 'pushState']({}, '', target.pathname + target.search);
    setRoute(readRoute(target.pathname,target.search));
  }, []);
  const setScreen = useCallback((screen,params) => navigate((publicPaths[screen] || '/') + (params ? `?${new URLSearchParams(params)}` : '')), [navigate]);
  const setSection = useCallback(section => {
    const target=new URL(`/portal/${section}`,window.location.origin);
    const child=new URLSearchParams(window.location.search).get('child');
    if(child&&!target.searchParams.has('child'))target.searchParams.set('child',child);
    navigate(target.pathname+target.search);
  }, [navigate]);
  useEffect(() => {
    document.title = `${route.portal ? experienceLabels[route.section] || 'Your portal' : pageLabels[route.screen] || 'Page not found'} · LearnWise Academy`;
    // The route heading gives keyboard and screen reader users a clear new context.
    document.querySelector('main')?.focus({ preventScroll:true });
    window.scrollTo?.({ top:0, behavior:'instant' });
  }, [route]);
  return { route, setScreen, setSection, navigate };
}
export function NavLink({ to, onNavigate, children, ...props }) {
  return <a href={to} {...props} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onNavigate();
  }}>{children}</a>;
}
