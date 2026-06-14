import Constants from "expo-constants";

import {
  isLocalDevApiHost,
  resolveDevApiBaseUrl,
} from "./resolveDevApiBaseUrl";

const DEFAULT_API_BASE = "https://api-netqwix.com";
const DEFAULT_WEB_APP_ORIGIN = "https://netqwix.com";
const DEFAULT_DEVDUDES_URL = "https://devdudes.dev";
const DEFAULT_DEVDUDES_LABEL = "DEVDUDES";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Strip BOM, quotes, and whitespace from .env values (common editor mistakes). */
function normalizeEnvUrl(raw: string | undefined, fallback: string): string {
  if (raw == null || raw === "") return fallback;
  const cleaned = raw
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!cleaned) return fallback;
  try {
    const u = new URL(cleaned);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return fallback;
    }
    return stripTrailingSlash(cleaned);
  } catch {
    return fallback;
  }
}

/** Value from `.env` before dev localhost rewrite (for diagnostics). */
export const API_BASE_URL_CONFIGURED = normalizeEnvUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL,
  DEFAULT_API_BASE
);

/**
 * Backend API origin. Set `EXPO_PUBLIC_API_BASE_URL` in `.env` (no spaces around `=`).
 * Restart Metro with cache clear after changes: `npx expo start -c`
 *
 * Dev note: `http://localhost:8000` is rewritten to your Mac's LAN IP on a physical device.
 */
export const API_BASE_URL = resolveDevApiBaseUrl(API_BASE_URL_CONFIGURED);

/** Public web origin — sent as `Origin` / `Referer` so API requests match browser traffic (many CDNs block RN defaults). */
export const WEB_APP_ORIGIN = normalizeEnvUrl(
  process.env.EXPO_PUBLIC_WEB_ORIGIN,
  DEFAULT_WEB_APP_ORIGIN
);

/** Stripe publishable key for mobile payment sheet. */
export const STRIPE_PUBLISHABLE_KEY =
  (process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "")
    .trim() || "";

/** Optional Apple Pay merchant id (required only when Apple Pay is enabled). */
export const STRIPE_APPLE_MERCHANT_IDENTIFIER =
  (process.env.EXPO_PUBLIC_STRIPE_APPLE_MERCHANT_IDENTIFIER ?? "").trim() || "";

/** Same value as web `NEXT_PUBLIC_GOOGLE_CLIENT_ID` when only one Web OAuth client exists. */
const GOOGLE_CLIENT_ID_SHARED =
  (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim() || "";

export const GOOGLE_IOS_CLIENT_ID =
  (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "").trim() || "";
export const GOOGLE_ANDROID_CLIENT_ID =
  (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "").trim() || "";
export const GOOGLE_WEB_CLIENT_ID =
  (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "").trim() ||
  GOOGLE_CLIENT_ID_SHARED ||
  "";

/**
 * Settings-footer "Made with [heart] by DEVDUDES" credit. Resolves in this order:
 *   1. `EXPO_PUBLIC_DEVDUDES_URL` / `EXPO_PUBLIC_DEVDUDES_LABEL` from `.env`
 *   2. `expo.extra.devdudes` block in `app.json` (or `app.config.ts`)
 *   3. Hard-coded default below
 * The label is kept env-driven so the rebrand to a partner agency only takes
 * an `app.json` edit, no JS code change.
 */
function readExtraDevdudes(): { url?: unknown; label?: unknown } {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const dd = (extra as { devdudes?: unknown }).devdudes;
  if (!dd || typeof dd !== "object") return {};
  return dd as { url?: unknown; label?: unknown };
}
const _extraDevdudes = readExtraDevdudes();

export const DEVDUDES_URL = normalizeEnvUrl(
  process.env.EXPO_PUBLIC_DEVDUDES_URL ??
    (typeof _extraDevdudes.url === "string" ? _extraDevdudes.url : undefined),
  DEFAULT_DEVDUDES_URL
);
export const DEVDUDES_LABEL = (() => {
  const fromEnv = (process.env.EXPO_PUBLIC_DEVDUDES_LABEL ?? "").trim();
  if (fromEnv) return fromEnv;
  const fromExtra =
    typeof _extraDevdudes.label === "string"
      ? _extraDevdudes.label.trim()
      : "";
  return fromExtra || DEFAULT_DEVDUDES_LABEL;
})();

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log(
    "[nq-mobile] API_BASE_URL =",
    API_BASE_URL,
    API_BASE_URL !== API_BASE_URL_CONFIGURED
      ? `(from .env ${API_BASE_URL_CONFIGURED})`
      : "",
    "| WEB_APP_ORIGIN =",
    WEB_APP_ORIGIN
  );
  // eslint-disable-next-line no-console
  console.log(
    "[nq-mobile] STRIPE_PUBLISHABLE_KEY prefix/len =",
    STRIPE_PUBLISHABLE_KEY ? `${STRIPE_PUBLISHABLE_KEY.slice(0, 12)}…` : "<empty>",
    STRIPE_PUBLISHABLE_KEY.length
  );
}

export { isLocalDevApiHost };

function readEnvBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw == null || raw.trim() === "") return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return defaultValue;
}

/**
 * Server-side game-plan PDF stitch (Phase 3 backend).
 * Set `EXPO_PUBLIC_SERVER_GAME_PLAN_PDF=false` to fall back to client expo-print upload.
 */
export const SERVER_GAME_PLAN_PDF_ENABLED = readEnvBool(
  process.env.EXPO_PUBLIC_SERVER_GAME_PLAN_PDF,
  true
);
