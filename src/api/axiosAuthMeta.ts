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

/**
 * Trainee-only routes return 401 when `account_type` is not trainee (backend middleware).
 * That is not an expired session — must not clear tokens app-wide.
 */
const TRAINEE_ONLY_SOFT_401_PATHS = [
  "/trainee/favorite-trainers",
  "/trainee/guest-activity",
];

/**
 * Routes that may 401 when called without a valid trainee session (guest browse,
 * stale token) — never treat as a global session expiry.
 */
const GUEST_OR_OPTIONAL_AUTH_SOFT_401_PATHS = [
  "/trainee/guest-activity/seeded-trainers",
];

export function isAuthNoSignOutPath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0] ?? url;
  return AUTH_NO_SIGNOUT_PATHS.some(
    (p) => path === p || path.endsWith(p)
  );
}

export function isSoft401Path(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0] ?? url;
  return (
    TRAINEE_ONLY_SOFT_401_PATHS.some((p) => path === p || path.endsWith(p)) ||
    GUEST_OR_OPTIONAL_AUTH_SOFT_401_PATHS.some((p) => path === p || path.endsWith(p))
  );
}
