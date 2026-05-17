import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { extractLoginTokens } from "../../../lib/http/parseLoginResponse";
import {
  getRefreshToken,
  getSessionId,
  saveSession,
  getAccountType,
} from "../session/tokenStorage";

export type AuthSessionRow = {
  id: string;
  publicId: string;
  deviceLabel: string;
  clientType: string;
  platform: string;
  loginMethod: string;
  ipAddress: string;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
};

function sessionHeaders(): Record<string, string> {
  return {};
}

async function withSessionContext(): Promise<Record<string, string>> {
  const sessionId = await getSessionId();
  const headers: Record<string, string> = { ...sessionHeaders() };
  if (sessionId) headers["X-NQ-Session-Id"] = sessionId;
  return headers;
}

function unwrapSessions(payload: unknown): AuthSessionRow[] {
  const data = (payload as { data?: { sessions?: AuthSessionRow[] } })?.data;
  if (Array.isArray(data?.sessions)) return data.sessions;
  const nested = (payload as { result?: { data?: { sessions?: AuthSessionRow[] } } })?.result?.data;
  if (Array.isArray(nested?.sessions)) return nested.sessions;
  return [];
}

/** Ensures this install has a tracked session (for users who signed in before session tracking). */
export async function ensureAuthSessionRegistered(): Promise<void> {
  const existing = await getSessionId();
  if (existing) return;
  const res = await apiClient.post(API_ROUTES.auth.sessionsRegister, {});
  const tokens = extractLoginTokens(res.data);
  if (!tokens) return;
  const accountType = (await getAccountType()) ?? tokens.account_type;
  await saveSession(tokens.access_token, accountType, {
    refreshToken: tokens.refresh_token,
    sessionId: tokens.session_id,
  });
}

export async function fetchAuthSessions(): Promise<AuthSessionRow[]> {
  await ensureAuthSessionRegistered();
  const res = await apiClient.get(API_ROUTES.auth.sessions, {
    headers: await withSessionContext(),
  });
  return unwrapSessions(res.data);
}

export async function revokeAuthSession(sessionId: string): Promise<void> {
  const refreshToken = await getRefreshToken();
  await apiClient.post(
    API_ROUTES.auth.sessionsRevoke,
    { sessionId, refresh_token: refreshToken ?? undefined },
    { headers: await withSessionContext() }
  );
}

export async function revokeOtherAuthSessions(): Promise<number> {
  const res = await apiClient.post(
    API_ROUTES.auth.sessionsRevokeOthers,
    {},
    { headers: await withSessionContext() }
  );
  const count =
    (res.data as { data?: { revokedCount?: number } })?.data?.revokedCount ??
    (res.data as { result?: { data?: { revokedCount?: number } } })?.result?.data?.revokedCount;
  return typeof count === "number" ? count : 0;
}

export async function postLogout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return;
  try {
    await apiClient.post(API_ROUTES.auth.logout, { refresh_token: refreshToken });
  } catch {
    /** Best-effort — local sign-out still proceeds. */
  }
}
