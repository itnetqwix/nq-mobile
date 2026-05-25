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
  const { data } = await apiClient.post(API_ROUTES.auth.signup, body);
  return data;
}

export async function postForgotPassword(email: string): Promise<unknown> {
  const { data } = await apiClient.post(API_ROUTES.auth.forgotPassword, { email: email.toLowerCase() });
  return data;
}

/** GET /user/me — userController returns `result.result` JSON; primary field is `userInfo`. */
export async function getCurrentUser(options?: {
  skipAuthSignOut?: boolean;
}): Promise<Record<string, unknown>> {
  const { data } = await apiClient.get<Record<string, unknown>>(API_ROUTES.user.me, {
    _skipAuthSignOut: options?.skipAuthSignOut,
  });
  const userInfo = (data as { userInfo?: Record<string, unknown> }).userInfo;
  if (userInfo && typeof userInfo === "object") {
    return userInfo;
  }
  return data ?? {};
}
