import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { extractLoginTokens, summarizeLoginPayloadKeys } from "../../lib/http/parseLoginResponse";
import { getApiErrorMessage } from "../../lib/http/getApiErrorMessage";
import { getCurrentUser, postLogin } from "../../features/auth/api/authApi";
import { fetchMasterRow } from "../../features/auth/api/masterApi";
import { ensureAuthSessionRegistered, postLogout } from "../../features/auth/api/authSessionsApi";
import {
  clearSession,
  getAccessToken,
  getAccountType,
  getSessionId,
  saveSession,
} from "../../features/auth/session/tokenStorage";
import { registerMyChatPublicKey } from "../../features/chats/crypto/chatKeysApi";
import { applyLanguageFromUser } from "../../i18n/applyLanguageFromUser";
import { queryKeys } from "../../lib/queryKeys";
import { getGlobalQueryClient } from "../queryClientRef";

export type AuthUser = Record<string, unknown> | null;
export type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthState = {
  status: AuthStatus;
  user: AuthUser;
  accountType: string | null;
};

const initialState: AuthState = {
  status: "loading",
  user: null,
  accountType: null,
};

export const hydrateAuth = createAsyncThunk(
  "auth/hydrate",
  async (_, { rejectWithValue }) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        return { user: null, accountType: null, signedIn: false as const };
      }
      const [me, at] = await Promise.all([getCurrentUser(), getAccountType()]);
      void applyLanguageFromUser(me);
      const sid = await getSessionId();
      if (!sid) void ensureAuthSessionRegistered().catch(() => undefined);
      return {
        user: me,
        accountType:
          at ?? (me?.account_type as string) ?? (me?.accountType as string) ?? null,
        signedIn: true as const,
      };
    } catch {
      await clearSession();
      return rejectWithValue("hydrate_failed");
    }
  }
);

export const completeSessionFromTokens = createAsyncThunk(
  "auth/completeSessionFromTokens",
  async (
    tokens: {
      access_token: string;
      account_type: string;
      refresh_token?: string;
      session_id?: string;
    },
    { rejectWithValue }
  ) => {
    await saveSession(tokens.access_token, tokens.account_type, {
      refreshToken: tokens.refresh_token,
      sessionId: tokens.session_id,
    });
    try {
      const me = await getCurrentUser();
      void applyLanguageFromUser(me);
      const qc = getGlobalQueryClient();
      qc?.invalidateQueries();
      void qc?.prefetchQuery({
        queryKey: queryKeys.master.row,
        queryFn: fetchMasterRow,
      });
      void registerMyChatPublicKey().catch(() => undefined);
      return { user: me, accountType: tokens.account_type };
    } catch (e) {
      await clearSession();
      return rejectWithValue(
        `Login succeeded but profile could not load: ${getApiErrorMessage(e)}`
      );
    }
  }
);

export const signInThunk = createAsyncThunk(
  "auth/signIn",
  async ({ email, password }: { email: string; password: string }, { dispatch, rejectWithValue }) => {
    try {
      const res = await postLogin({ email, password });
      const tokens = extractLoginTokens(res);
      if (!tokens) {
        return rejectWithValue(
          `Unexpected login response (no tokens). ${summarizeLoginPayloadKeys(res)}`
        );
      }
      const result = await dispatch(completeSessionFromTokens(tokens));
      if (completeSessionFromTokens.rejected.match(result)) {
        return rejectWithValue(String(result.payload));
      }
      return result.payload;
    } catch (e) {
      return rejectWithValue(getApiErrorMessage(e, "Sign in failed."));
    }
  }
);

export const signOutThunk = createAsyncThunk("auth/signOut", async () => {
  try {
    await postLogout();
    await clearSession();
  } catch {
    /** Still sign out locally. */
  }
  getGlobalQueryClient()?.clear();
});

export const refreshUserThunk = createAsyncThunk("auth/refreshUser", async () => {
  const token = await getAccessToken();
  if (!token) return null;
  const me = await getCurrentUser();
  void applyLanguageFromUser(me);
  const at = await getAccountType();
  return {
    user: me,
    accountType: at ?? (me?.account_type as string) ?? (me?.accountType as string) ?? null,
  };
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    patchUser(state, action: PayloadAction<Record<string, unknown>>) {
      state.user = state.user
        ? { ...state.user, ...action.payload }
        : { ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateAuth.pending, (state) => {
        state.status = "loading";
      })
      .addCase(hydrateAuth.fulfilled, (state, action) => {
        if (action.payload.signedIn === false) {
          state.user = null;
          state.accountType = null;
          state.status = "signedOut";
          return;
        }
        state.user = action.payload.user;
        state.accountType = action.payload.accountType;
        state.status = "signedIn";
      })
      .addCase(hydrateAuth.rejected, (state) => {
        state.user = null;
        state.accountType = null;
        state.status = "signedOut";
      })
      .addCase(completeSessionFromTokens.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.accountType = action.payload.accountType;
        state.status = "signedIn";
      })
      .addCase(signInThunk.fulfilled, (state, action) => {
        const payload = action.payload as { user: AuthUser; accountType: string } | undefined;
        if (!payload) return;
        state.user = payload.user;
        state.accountType = payload.accountType;
        state.status = "signedIn";
      })
      .addCase(signOutThunk.fulfilled, (state) => {
        state.user = null;
        state.accountType = null;
        state.status = "signedOut";
      })
      .addCase(refreshUserThunk.fulfilled, (state, action) => {
        if (!action.payload) return;
        state.user = action.payload.user;
        if (action.payload.accountType) state.accountType = action.payload.accountType;
      });
  },
});

export const { patchUser } = authSlice.actions;
export default authSlice.reducer;
