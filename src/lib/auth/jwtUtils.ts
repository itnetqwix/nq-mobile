/** Decode JWT payload without verification (client-side expiry hints only). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    if (typeof atob !== "function") return null;
    const json = atob(padded);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function getAccessTokenExpiryMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  return typeof exp === "number" ? exp * 1000 : null;
}

/** True when the access token expires within `withinSeconds` (or is already expired). */
export function accessTokenExpiresWithin(token: string, withinSeconds: number): boolean {
  const expMs = getAccessTokenExpiryMs(token);
  if (!expMs) return false;
  return expMs <= Date.now() + withinSeconds * 1000;
}
