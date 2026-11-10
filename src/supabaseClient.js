import { createClient } from "@supabase/supabase-js";
import { initializeSupabase } from "./config/supabase";
import { createRecoveryState } from './features/auth/passwordRecovery';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const result = initializeSupabase(createClient, supabaseUrl, supabaseAnonKey);

if (!result.configured) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase env vars are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file (see .env.example)."
  );
}

export const supabase = result.client;
export const supabaseConfigured = result.configured;
export const recoveryState = createRecoveryState(supabase);
if (import.meta.hot) import.meta.hot.dispose(() => recoveryState.stop());
