import { safeServiceAction } from './services/availability.js';
import React, { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { supabase, recoveryState } from "./supabaseClient";
import { ROLES, SIGNUP_ROLES } from "./config/roles";
import { createAuthSession } from "./features/auth/authSession";
import { createPasswordRecovery } from './features/auth/passwordRecovery';

export const AuthContext = createContext(null);

// Roles that are safe to accept from signup metadata.
// super_admin and admin_tutor can NEVER be self-assigned.
const SAFE_SIGNUP_ROLES = SIGNUP_ROLES; // ["tutor", "parent", "student"]
const unavailableAuth = () => ({ data: null, error: { message: "Account access is temporarily unavailable. Please try again later." } });

export function AuthProvider({ children }) {
  const [{ user, profile, loading, authError }, setSession] = useState({
    user: null, profile: null, loading: !!supabase, authError: null,
  });
  const sessionController = useRef(null);
  const recoveryUserId = useSyncExternalStore(recoveryState.subscribe, recoveryState.getSnapshot, recoveryState.getSnapshot);
  const passwordRecovery = !!user && recoveryUserId === user.id;

  useEffect(() => {
    const controller = createAuthSession(supabase, setSession);
    sessionController.current = controller;
    controller.start();
    return () => {
      controller.stop();
      sessionController.current = null;
    };
  }, []);

  const signUp = async ({ email, password, fullName, role }) => {
    if (!supabase) return unavailableAuth();
    // Sanitise role before passing to Supabase auth metadata
    const safeRole = SAFE_SIGNUP_ROLES.includes(role) ? role : ROLES.STUDENT;
    const { data, error } = await safeServiceAction(() => supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: safeRole } },
    }));
    return { data, error };
  };

  const signIn = async ({ email, password }) => {
    if (!supabase) return unavailableAuth();
    const { data, error } = await safeServiceAction(() => supabase.auth.signInWithPassword({
      email,
      password,
    }));
    return { data, error };
  };

  const signOut = async () => {
    recoveryState.clear();
    sessionController.current?.clear();
    return supabase ? safeServiceAction(() => supabase.auth.signOut()) : { error: null };
  };

  // Helpers for App.jsx routing — avoids role string comparisons outside this file
  const isStaff      = profile?.role === ROLES.SUPER_ADMIN || profile?.role === ROLES.ADMIN_TUTOR;
  const isSuperAdmin = profile?.role === ROLES.SUPER_ADMIN;
  const isAdminTutor = profile?.role === ROLES.ADMIN_TUTOR;
  const isTutor      = profile?.role === ROLES.TUTOR;
  const isParent     = profile?.role === ROLES.PARENT;
  const isStudent    = profile?.role === ROLES.STUDENT;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authError,
        signUp,
        signIn,
        signOut,
        passwordRecovery,
        requestPasswordReset: email => createPasswordRecovery(supabase).request(email, window.location.origin),
        updatePassword: password => createPasswordRecovery(supabase).update(password, passwordRecovery && !!user),
        refreshProfile: () => sessionController.current?.refresh(),
        // Role shorthand booleans
        isStaff,
        isSuperAdmin,
        isAdminTutor,
        isTutor,
        isParent,
        isStudent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
