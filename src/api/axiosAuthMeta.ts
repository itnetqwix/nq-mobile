import type { InternalAxiosRequestConfig } from "axios";

export type AuthAxiosMeta = {
  /** Set when the response interceptor already retried after refresh. */
  _authRetried?: boolean;
  /** Caller handles 401 (e.g. login form) — do not run global sign-out. */
  _skipAuthSignOut?: boolean;
};

/**
 * Module augmentation: expose our auth-meta flags on `AxiosRequestConfig`
 * so call-sites can pass `{ _skipAuthSignOut: true }` directly without
 * needing an awkward `as` cast on every request. The interceptor at the
 * client layer reads these via {@link getAuthAxiosMeta}; nothing else
 * changes about the shape on the wire.
 *
 * Keeping the declaration co-located with the meta type means the
 * surface stays discoverable — any future flag we add here will land in
 * the public config shape with one extra line below.
 */
declare module "axios" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface AxiosRequestConfig extends Partial<AuthAxiosMeta> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface InternalAxiosRequestConfig extends Partial<AuthAxiosMeta> {}
}

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
const TRAINEE_ONLY_SOFT_401_PATHS = ["/trainee/favorite-trainers"];

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
  return TRAINEE_ONLY_SOFT_401_PATHS.some(
    (p) => path === p || path.endsWith(p)
  );
}
