// Supabase auth notifications must return synchronously. Profile queries run
// afterward; revision checks prevent old responses from restoring permissions.
export function createAuthSession(client, onChange, defer = fn => setTimeout(fn, 0)) {
  let active = true;
  let revision = 0;
  let currentUser = null;
  let subscription;

  const emit = state => { if (active) onChange(state); };
  const fail = (user, ticket) => {
    if (active && ticket === revision) {
      emit({ user, profile: null, loading: false, authError: 'Unable to load your account. Please retry or contact LearnWise Academy.' });
    }
  };

  async function load(user, ticket) {
    if (!active || ticket !== revision) return null;
    try {
      const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (!active || ticket !== revision) return null;
      if (error || !data || data.id !== user.id) {
        fail(user, ticket);
        return null;
      }
      emit({ user, profile: data, loading: false, authError: null });
      return data;
    } catch {
      fail(user, ticket);
      return null;
    }
  }

  function receive(session) {
    if (!active) return;
    const ticket = ++revision;
    currentUser = session?.user || null;
    const user = currentUser;
    emit({ user, profile: null, loading: !!user, authError: null });
    if (user) defer(() => { void load(user, ticket); });
  }

  async function restore(ticket) {
    try {
      const { data, error } = await client.auth.getSession();
      if (!active || revision !== ticket) return;
      if (error) fail(null, ticket);
      else receive(data?.session);
    } catch { fail(null, ticket); }
  }

  return {
    start() {
      if (!client) { receive(null); return; }
      const initialRevision = revision;
      const result = client.auth.onAuthStateChange((_event, session) => {
        receive(session);
      });
      subscription = result.data.subscription;
      // An auth event always wins over an older initial session snapshot.
      void restore(initialRevision);
    },
    refresh() {
      if (!active) return Promise.resolve(null);
      if (!client) { receive(null); return Promise.resolve(null); }
      const ticket = ++revision;
      emit({ user: currentUser, profile: null, loading: true, authError: null });
      return currentUser ? load(currentUser, ticket) : restore(ticket);
    },
    clear() { receive(null); },
    stop() {
      active = false;
      ++revision;
      subscription?.unsubscribe();
    },
  };
}
