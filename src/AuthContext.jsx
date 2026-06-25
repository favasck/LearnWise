import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { ROLES, SIGNUP_ROLES } from "./config/roles";

const AuthContext = createContext(null);

// Roles that are safe to accept from signup metadata.
// super_admin and admin_tutor can NEVER be self-assigned.
const SAFE_SIGNUP_ROLES = SIGNUP_ROLES; // ["tutor", "parent", "student"]

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (authUser) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
      return data;
    }

    // Profile missing — create it now with a safe fallback role.
    // Any attempt to self-assign super_admin/admin_tutor/admin
    // via metadata is blocked here (and also by handle_new_user in DB).
    if (!data && !error) {
      const rawRole     = authUser.user_metadata?.role;
      const fallbackRole = SAFE_SIGNUP_ROLES.includes(rawRole) ? rawRole : ROLES.STUDENT;
      const fallbackName = authUser.user_metadata?.full_name || authUser.email;

      const { data: created } = await supabase
        .from("profiles")
        .insert({
          id:        authUser.id,
          full_name: fallbackName,
          email:     authUser.email,
          role:      fallbackRole,
          status:    "Active",
        })
        .select()
        .single();

      if (created) {
        setProfile(created);
        return created;
      }
    }

    return null;
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user || null);
      if (session?.user) await loadProfile(session.user);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user || null);
        if (session?.user) {
          await loadProfile(session.user);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const signUp = async ({ email, password, fullName, role }) => {
    // Sanitise role before passing to Supabase auth metadata
    const safeRole = SAFE_SIGNUP_ROLES.includes(role) ? role : ROLES.STUDENT;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: safeRole } },
    });
    return { data, error };
  };

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (data?.user) await loadProfile(data.user);
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
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
        signUp,
        signIn,
        signOut,
        refreshProfile: () => user && loadProfile(user),
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
