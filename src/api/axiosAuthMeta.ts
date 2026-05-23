import type { InternalAxiosRequestConfig } from "axios";

export type AuthAxiosMeta = {
  /** Set when the response interceptor already retried after refresh. */
  _authRetried?: boolean;
  /** Caller handles 401 (e.g. login form) — do not run global sign-out. */
  _skipAuthSignOut?: boolean;
};

export function getAuthAxiosMeta(
  config: InternalAxiosRequestConfig
): AuthAxiosMeta {
  return config as InternalAxiosRequestConfig & AuthAxiosMeta;
}

export function bearerFromAuthHeader(
  header: string | undefined
): string | null {
  if (!header || typeof header !== "string") return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim();
  if (!token || token === "null" || token === "undefined") return null;
  return token;
}

const AUTH_NO_SIGNOUT_PATHS = [
  "/auth/login",
  "/auth/refresh",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/confirm-reset-password",
  "/auth/verify-google-login",
  "/auth/verify-apple-login",
];

export function isAuthNoSignOutPath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0] ?? url;
  return AUTH_NO_SIGNOUT_PATHS.some(
    (p) => path === p || path.endsWith(p)
  );
}
