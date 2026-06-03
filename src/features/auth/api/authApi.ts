import { isAxiosError } from "axios";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../constants/routes";
import type { LoginResponse, SignUpPayload } from "./types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientNetworkError(e: unknown): boolean {
  if (!isAxiosError(e)) return false;
  if (e.code === "ERR_NETWORK" || e.code === "ECONNABORTED") return true;
  const msg = (e.message || "").toLowerCase();
  if (msg === "network error") return true;
  if (msg.includes("network request failed")) return true;
  return false;
}

/**
 * POST `/auth/login` — same contract as web `auth.api.js` (`loginModel`: `email`, `password`).
 * Retries a few times on transient transport failures (common on mobile / flaky Wi‑Fi).
 */
export async function postLogin(body: { email: string; password: string }): Promise<LoginResponse> {
  const payload = {
    email: body.email.trim().toLowerCase(),
    password: body.password,
  };
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data } = await apiClient.post<LoginResponse>(API_ROUTES.auth.login, payload);
      return data;
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts && isTransientNetworkError(e)) {
        await sleep(350 * attempt);
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

export async function postSignUp(payload: SignUpPayload): Promise<unknown> {
  const body: Record<string, unknown> = {
    ...payload,
    email: payload.email.toLowerCase(),
    isGoogleRegister: payload.isGoogleRegister ?? false,
  };
  if (payload.referral_code) body.referral_code = payload.referral_code;
  if (payload.referrer_id) body.referrer_id = payload.referrer_id;
  const { data } = await apiClient.post(API_ROUTES.auth.signup, body);
  return data;
}

export async function postForgotPassword(email: string): Promise<unknown> {
  const { data } = await apiClient.post(API_ROUTES.auth.forgotPassword, { email: email.toLowerCase() });
  return data;
}

/** Normalise GET /user/me bodies (`userInfo` at top level or under `data` / `result`). */
export function parseUserMeResponse(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  const root = data as Record<string, unknown>;
  if (root.userInfo && typeof root.userInfo === "object" && !Array.isArray(root.userInfo)) {
    return root.userInfo as Record<string, unknown>;
  }
  const nested = root.data ?? root.result;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const block = nested as Record<string, unknown>;
    if (block.userInfo && typeof block.userInfo === "object" && !Array.isArray(block.userInfo)) {
      return block.userInfo as Record<string, unknown>;
    }
    const inner = block.data;
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      const innerBlock = inner as Record<string, unknown>;
      if (
        innerBlock.userInfo &&
        typeof innerBlock.userInfo === "object" &&
        !Array.isArray(innerBlock.userInfo)
      ) {
        return innerBlock.userInfo as Record<string, unknown>;
      }
    }
  }
  return root;
}

function resolveAccountType(
  user: Record<string, unknown>,
  fallback?: string | null
): string | null {
  const fromUser =
    (user.account_type as string) ?? (user.accountType as string) ?? null;
  return fromUser ?? fallback ?? null;
}

/** GET /user/me — userController returns `result.result` JSON; primary field is `userInfo`. */
export async function getCurrentUser(options?: {
  skipAuthSignOut?: boolean;
}): Promise<Record<string, unknown>> {
  const { data } = await apiClient.get<Record<string, unknown>>(API_ROUTES.user.me, {
    _skipAuthSignOut: options?.skipAuthSignOut,
  } as { _skipAuthSignOut?: boolean });
  return parseUserMeResponse(data);
}

export { resolveAccountType };
