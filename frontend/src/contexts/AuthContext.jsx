import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * DiagnoVision — Auth Context
 * Provides session, user, profile (with role), and auth methods to the whole app.
 * Profile row is fetched from public.profiles after every sign-in / token refresh.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch the user's profile row from public.profiles.
   * Called after login / session restore. Returns null if not found.
   */
  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, status, created_at, updated_at')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[AuthContext] Error fetching profile:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[AuthContext] Unexpected error fetching profile:', err);
      return null;
    }
  }, []);

  /**
   * Initialize: get current session + listen for auth state changes.
   */
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          const profileData = await fetchProfile(currentSession.user.id);
          if (mounted) setProfile(profileData);
        }
      } catch (err) {
        console.error('[AuthContext] Error restoring session:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initSession();

    // Subscribe to auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          const profileData = await fetchProfile(newSession.user.id);
          if (mounted) {
            setProfile(profileData);
            setLoading(false);
          }
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Sign up with email + password.
   * Passes full_name and role as user_metadata so the DB trigger
   * (handle_new_user) can populate the profiles row.
   */
  const signUp = useCallback(async ({ email, password, fullName, role = 'general' }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });
    return { data, error };
  }, []);

  /**
   * Sign in with email + password.
   * Fetches profile before resolving to avoid route-guard race conditions.
   */
  const signIn = useCallback(async ({ email, password }) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!error && data?.user) {
      setSession(data.session);
      setUser(data.user);
      const profileData = await fetchProfile(data.user.id);
      setProfile(profileData);
      setLoading(false);
      return { data, error: null, profile: profileData };
    }
    setLoading(false);
    return { data, error };
  }, [fetchProfile]);

  /**
   * Sign out and clear local state.
   */
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setSession(null);
      setUser(null);
      setProfile(null);
    }
    return { error };
  }, []);

  /**
   * Refresh the profile from the DB (e.g. after editing).
   */
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
      return profileData;
    }
    return null;
  }, [user, fetchProfile]);

  /**
   * Verify OTP for email confirmation or recovery.
   */
  const verifyOtp = useCallback(async ({ email, token, type = 'signup' }) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });
    return { data, error };
  }, []);

  /**
   * Send password reset OTP to user's email via custom SMTP.
   * Sends the 6-digit recovery OTP ({{ .Token }} in Supabase email template).
   */
  const resetPasswordForEmail = useCallback(async ({ email }) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    return { data, error };
  }, []);

  /**
   * Verify 6-digit OTP sent via email for password reset.
   * Checks type: 'recovery' first, then falls back to type: 'email' if needed.
   */
  const verifyResetOtp = useCallback(async ({ email, token }) => {
    // 1. Try recovery type (standard Supabase password reset OTP)
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'recovery',
    });

    if (!error) {
      return { data, error: null };
    }

    // 2. Fallback: try email OTP type in case SMTP/Supabase sent as email OTP
    const fallback = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    return fallback.error ? { data, error } : fallback;
  }, []);

  /**
   * Update password for the current authenticated user / recovery session.
   */
  const updateUserPassword = useCallback(async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { data, error };
  }, []);

  const currentRole = profile?.role || user?.user_metadata?.role;

  const value = useMemo(() => ({
    session,
    user,
    profile,
    loading,
    profileLoading: !!user && profile === null,
    signUp,
    signIn,
    signOut,
    verifyOtp,
    resetPasswordForEmail,
    verifyResetOtp,
    updateUserPassword,
    refreshProfile,
    isAuthenticated: !!session,
    isAdmin: currentRole === 'admin',
    isMedicalStaff: currentRole === 'medical_staff' || currentRole === 'admin',
  }), [
    session,
    user,
    profile,
    loading,
    currentRole,
    signUp,
    signIn,
    signOut,
    verifyOtp,
    resetPasswordForEmail,
    verifyResetOtp,
    updateUserPassword,
    refreshProfile,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to consume the auth context.
 * Throws if used outside AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
