import React, { useCallback, useEffect, useState } from 'react';

export const publicPaths = {
  home:'/', about:'/about', subjects:'/subjects', igcse:'/igcse', online:'/online-tuition',
  assessment:'/assessment', contact:'/contact', signin:'/login', signup:'/signup', staff:'/staff/login',
  forgot:'/forgot-password', reset:'/reset-password',
  authlinkerror:'/auth/link-error',
};
export const pageLabels = { home:'Home', about:'About', subjects:'Subjects', igcse:'IGCSE / Edexcel', online:'Online Tuition', assessment:'Book Assessment', contact:'Contact', signin:'Sign in', signup:'Create an account', staff:'Staff sign in', forgot:'Reset password', reset:'Choose a password', authlinkerror:'Email link unavailable' };
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
  const setSection = useCallback(section => navigate(`/portal/${section}`), [navigate]);
  useEffect(() => {
    document.title = `${route.portal ? 'Your portal' : pageLabels[route.screen] || 'Page not found'} · LearnWise Academy`;
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
