import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import supabase from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid, attempt = 0) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (!error && data) {
      setProfile(data);
      return;
    }
    // The profile row is created by a database trigger right after sign-up,
    // so it can briefly 404. Retry a couple of times.
    if (attempt < 3) {
      setTimeout(() => fetchProfile(uid, attempt + 1), 900);
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => sub.subscription.unsubscribe();
  }, [fetchProfile]);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const register = async ({ fullName, email, password, role, teamId }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role || 'fan',
          team_id: teamId || null,
        },
      },
    });
    if (error) throw new Error(error.message);
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = () => {
    if (user) fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
