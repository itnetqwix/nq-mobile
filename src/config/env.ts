const DEFAULT_API_BASE = "https://api-netqwix.com";
const DEFAULT_WEB_APP_ORIGIN = "https://www.netqwix.com";

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

/**
 * Backend API origin. Set `EXPO_PUBLIC_API_BASE_URL` in `.env` (no spaces around `=`).
 * Restart Metro with cache clear after changes: `npx expo start -c`
 */
export const API_BASE_URL = normalizeEnvUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL,
  DEFAULT_API_BASE
);

/** Public web origin — sent as `Origin` / `Referer` so API requests match browser traffic (many CDNs block RN defaults). */
export const WEB_APP_ORIGIN = normalizeEnvUrl(
  process.env.EXPO_PUBLIC_WEB_ORIGIN,
  DEFAULT_WEB_APP_ORIGIN
);

/** Stripe publishable key for mobile payment sheet. */
export const STRIPE_PUBLISHABLE_KEY =
  (process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").trim() || "";

export const GOOGLE_IOS_CLIENT_ID =
  (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "").trim() || "";
export const GOOGLE_ANDROID_CLIENT_ID =
  (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "").trim() || "";
export const GOOGLE_WEB_CLIENT_ID =
  (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "").trim() || "";

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log("[nq-mobile] API_BASE_URL =", API_BASE_URL, "| WEB_APP_ORIGIN =", WEB_APP_ORIGIN);
}
