import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { extractLoginTokens, summarizeLoginPayloadKeys } from "../../../lib/http/parseLoginResponse";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { getCurrentUser, postLogin } from "../api/authApi";
import { fetchMasterRow } from "../api/masterApi";
import { onUnauthorized } from "../../../lib/auth/sessionEvents";
import { ensureAuthSessionRegistered, postLogout } from "../api/authSessionsApi";
import {
  clearSession,
  getAccessToken,
  getAccountType,
  getSessionId,
  saveSession,
} from "../session/tokenStorage";
import { registerMyChatPublicKey } from "../../chats/crypto/chatKeysApi";

export type AuthUser = Record<string, unknown> | null;

type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser;
  accountType: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  completeSessionFromTokens: (tokens: {
    access_token: string;
    account_type: string;
    refresh_token?: string;
    session_id?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  patchUser: (patch: Record<string, unknown>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser>(null);
  const [accountType, setAccountType] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const me = await getCurrentUser();
    setUser(me);
    const at = await getAccountType();
    if (at) setAccountType(at);
  }, []);

  const patchUser = useCallback((patch: Record<string, unknown>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : { ...patch }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          if (!cancelled) {
            setUser(null);
            setAccountType(null);
            setStatus("signedOut");
          }
          return;
        }
        const me = await getCurrentUser();
        const at = await getAccountType();
        if (cancelled) return;
        setUser(me);
        setAccountType(at ?? (me?.account_type as string) ?? (me?.accountType as string) ?? null);
        setStatus("signedIn");
        const sid = await getSessionId();
        if (!sid) void ensureAuthSessionRegistered().catch(() => undefined);
      } catch {
        await clearSession();
        if (!cancelled) {
          setUser(null);
          setAccountType(null);
          setStatus("signedOut");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completeSessionFromTokens = useCallback(
    async (tokens: {
      access_token: string;
      account_type: string;
      refresh_token?: string;
      session_id?: string;
    }) => {
      await saveSession(tokens.access_token, tokens.account_type, {
        refreshToken: tokens.refresh_token,
        sessionId: tokens.session_id,
      });
      try {
        const me = await getCurrentUser();
        setUser(me);
        setAccountType(tokens.account_type);
        setStatus("signedIn");
        queryClient.invalidateQueries();
        void queryClient.prefetchQuery({
          queryKey: ["masterRow"],
          queryFn: fetchMasterRow,
        });
        void registerMyChatPublicKey().catch(() => undefined);
      } catch (e) {
        await clearSession();
        throw new Error(
          `Login succeeded but profile could not load: ${getApiErrorMessage(e)}`
        );
      }
    },
    [queryClient]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      let res: Awaited<ReturnType<typeof postLogin>>;
      try {
        res = await postLogin({ email, password });
      } catch (e) {
        throw new Error(getApiErrorMessage(e, "Sign in failed."));
      }

      const tokens = extractLoginTokens(res);
      if (!tokens) {
        throw new Error(
          `Unexpected login response (no tokens). ${summarizeLoginPayloadKeys(res)}`
        );
      }

      await completeSessionFromTokens(tokens);
    },
    [completeSessionFromTokens]
  );

  const signOut = useCallback(async () => {
    try {
      await postLogout();
      await clearSession();
    } catch {
      /** Still leave the app in a signed-out state so the user can sign in again. */
    } finally {
      setUser(null);
      setAccountType(null);
      setStatus("signedOut");
      queryClient.clear();
    }
  }, [queryClient]);

  useEffect(() => {
    return onUnauthorized(() => {
      void signOut();
    });
  }, [signOut]);

  const value = useMemo(
    () => ({
      status,
      user,
      accountType,
      signIn,
      completeSessionFromTokens,
      signOut,
      refreshUser,
      patchUser,
    }),
    [status, user, accountType, signIn, completeSessionFromTokens, signOut, refreshUser, patchUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
