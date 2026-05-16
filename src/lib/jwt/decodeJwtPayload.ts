/** Decode JWT payload (no signature verification — server verifies). */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1];
    if (!part) return {};
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function emailFromIdToken(idToken: string): string | null {
  const payload = decodeJwtPayload(idToken);
  const email = payload.email;
  return typeof email === "string" && email.includes("@") ? email.toLowerCase() : null;
}
