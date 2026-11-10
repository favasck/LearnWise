import { safeServiceAction } from '../../services/availability.js';

// Subscribe when the client is created, before React mounts: the recovery event
// may arrive before an AuthProvider effect is installed. Retain only the user ID.
export function createRecoveryState(client, options = {}) {
  let userId = null;
  let expiresAt = 0;
  let expiryTimer;
  const listeners = new Set();
  const storageKey = 'learnwise.recovery';
  const now = options.now || Date.now;
  const storage = () => options.storage || (typeof window !== 'undefined' ? window.sessionStorage : null);
  const clear = () => {
    clearTimeout(expiryTimer); userId = null; expiresAt = 0;
    try { storage()?.removeItem(storageKey); } catch { /* Storage can be disabled. */ }
    listeners.forEach(listener => listener());
  };
  const scheduleExpiry = () => { clearTimeout(expiryTimer); expiryTimer = setTimeout(clear,Math.max(0,expiresAt-now())); expiryTimer.unref?.(); };
  try {
    const stored = JSON.parse(storage()?.getItem(storageKey) || 'null');
    if (typeof stored?.userId === 'string' && stored.expiresAt > now() && stored.expiresAt <= now()+600000) {
      userId = stored.userId; expiresAt = stored.expiresAt; scheduleExpiry();
    } else storage()?.removeItem(storageKey);
  } catch { /* Recovery still works in memory if storage is unavailable. */ }
  const result = client?.auth.onAuthStateChange((event,session) => {
    if (event === 'PASSWORD_RECOVERY') {
      userId = session?.user?.id || null;
      expiresAt = now()+600000;
      try { storage()?.setItem(storageKey,JSON.stringify({userId,expiresAt})); } catch { /* Use memory only. */ }
      scheduleExpiry();
      listeners.forEach(listener => listener());
    } else if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || (userId && session?.user?.id !== userId)) clear();
  });
  return {
    getSnapshot:() => userId,
    subscribe:listener => { listeners.add(listener); return () => listeners.delete(listener); },
    clear,
    stop:() => { clearTimeout(expiryTimer); result?.data.subscription.unsubscribe(); listeners.clear(); userId = null; },
  };
}

export function createPasswordRecovery(client) {
  return {
    request(email, origin) {
      if (!client) return Promise.resolve({error:{message:'Account access is temporarily unavailable. Please try again later.'}});
      // The root is the existing production callback. The recovery observer opens
      // the password screen on any route, without requiring a new redirect entry.
      return safeServiceAction(() => client.auth.resetPasswordForEmail(email.trim(), {redirectTo:new URL('/',origin).href}));
    },
    update(password, recoveryReady) {
      if (!client || !recoveryReady) return Promise.resolve({error:{message:'Open a new password reset link from your email to continue.'}});
      return safeServiceAction(() => client.auth.updateUser({password}));
    },
  };
}
