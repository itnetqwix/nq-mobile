import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useProactiveTokenRefresh } from "../../../lib/auth/useProactiveTokenRefresh";
import {
  completeSessionFromTokens as completeSessionFromTokensThunk,
  patchUser,
  refreshUserThunk,
  signInThunk,
  signOutThunk,
} from "../../../store/slices/authSlice";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import {
  selectAccountType,
  selectAuthStatus,
  selectAuthUser,
} from "../../../store/selectors";

export type AuthUser = Record<string, unknown> | null;
export type AuthStatus = "loading" | "signedOut" | "signedIn";

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

/** Thin bridge — state lives in Redux (`auth` slice). */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAuthStatus);
  const user = useAppSelector(selectAuthUser);
  const accountType = useAppSelector(selectAccountType);

  useProactiveTokenRefresh(status === "signedIn");

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await dispatch(signInThunk({ email, password }));
      if (signInThunk.rejected.match(result)) {
        const payload = result.payload as
          | {
              message?: string;
              accountState?: string | null;
              wakeUpRequired?: boolean;
              pendingDeletion?: boolean;
            }
          | string
          | undefined;
        const message =
          typeof payload === "string"
            ? payload
            : payload?.message ?? "Sign in failed.";
        const err: Error & {
          accountState?: string | null;
          wakeUpRequired?: boolean;
          pendingDeletion?: boolean;
        } = new Error(message);
        if (payload && typeof payload !== "string") {
          err.accountState = payload.accountState ?? null;
          err.wakeUpRequired = !!payload.wakeUpRequired;
          err.pendingDeletion = !!payload.pendingDeletion;
        }
        throw err;
      }
    },
    [dispatch]
  );

  const completeSessionFromTokens = useCallback(
    async (tokens: {
      access_token: string;
      account_type: string;
      refresh_token?: string;
      session_id?: string;
    }) => {
      const result = await dispatch(completeSessionFromTokensThunk(tokens));
      if (completeSessionFromTokensThunk.rejected.match(result)) {
        throw new Error(String(result.payload ?? "Session failed."));
      }
    },
    [dispatch]
  );

  const signOut = useCallback(async () => {
    await dispatch(signOutThunk());
  }, [dispatch]);

  const refreshUser = useCallback(async () => {
    await dispatch(refreshUserThunk());
  }, [dispatch]);

  const patchUserLocal = useCallback(
    (patch: Record<string, unknown>) => {
      dispatch(patchUser(patch));
    },
    [dispatch]
  );

  const value = useMemo(
    () => ({
      status,
      user,
      accountType,
      signIn,
      completeSessionFromTokens,
      signOut,
      refreshUser,
      patchUser: patchUserLocal,
    }),
    [
      status,
      user,
      accountType,
      signIn,
      completeSessionFromTokens,
      signOut,
      refreshUser,
      patchUserLocal,
    ]
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

/** Read auth directly from Redux (no context). */
export function useAuthStore() {
  const status = useAppSelector(selectAuthStatus);
  const user = useAppSelector(selectAuthUser);
  const accountType = useAppSelector(selectAccountType);
  return { status, user, accountType };
}
