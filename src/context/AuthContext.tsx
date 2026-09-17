import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearStoredActivity,
  readRecoveryFlag,
  urlLooksLikeRecovery,
  writeRecoveryFlag,
} from "../lib/session";
import { supabase } from "../lib/supabase";

type AuthResult = { error: Error | null };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isRecovery: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (
    email: string,
    password: string,
    inviteCode: string
  ) => Promise<AuthResult & { session: Session | null }>;
  signOut: () => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Something went wrong.");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(() => readRecoveryFlag());

  const applyRecovery = useCallback((on: boolean) => {
    writeRecoveryFlag(on);
    setIsRecovery(on);
  }, []);

  useEffect(() => {
    let cancelled = false;

    function applySession(event: AuthChangeEvent | null, next: Session | null) {
      if (cancelled) return;
      setSession(next);
      if (event === "PASSWORD_RECOVERY") {
        applyRecovery(true);
      } else if (event === "SIGNED_OUT" || !next) {
        applyRecovery(false);
      } else if (
        next &&
        (event === "INITIAL_SESSION" || event === null) &&
        (readRecoveryFlag() || urlLooksLikeRecovery())
      ) {
        applyRecovery(true);
      } else if (next && readRecoveryFlag()) {
        setIsRecovery(true);
      }
      setLoading(false);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      applySession(event, next);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setSession(null);
        applyRecovery(false);
        setLoading(false);
        return;
      }
      applySession(null, data.session ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applyRecovery]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? asError(error) : null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, inviteCode: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { invite_code: inviteCode },
        },
      });
      return {
        error: error ? asError(error) : null,
        session: data.session ?? null,
      };
    },
    []
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) return { error: asError(error) };
    applyRecovery(false);
    clearStoredActivity();
    return { error: null };
  }, [applyRecovery]);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? asError(error) : null };
  }, []);

  const updatePassword = useCallback(
    async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { error: asError(error) };
      applyRecovery(false);
      return { error: null };
    },
    [applyRecovery]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      isRecovery,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
    }),
    [
      session,
      loading,
      isRecovery,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook paired with provider
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
