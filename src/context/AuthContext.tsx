import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getOAuthRedirectToProfile } from '@/lib/oauthRedirectOrigin';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  authMode: 'supabase' | 'dev';
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data: { session: next } }) => {
      setSession(next);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      authMode: isSupabaseConfigured() ? 'supabase' : 'dev',
      signInWithGoogle: async () => {
        if (!supabase) {
          throw new Error('Supabase is not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).');
        }
        const redirectTo = getOAuthRedirectToProfile();
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            /** Return the provider URL so we always navigate explicitly (embedded browsers often skip auto-redirect). */
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (data?.url) {
          window.location.assign(data.url);
          return;
        }
        throw new Error(
          'Google sign-in did not return a redirect URL. Add this site to Supabase Auth → URL Configuration redirect allow list.',
        );
      },
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
