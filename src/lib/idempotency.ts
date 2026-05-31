/** Client idempotency keys for Month 2 wallet/booking POSTs (server requires header). */

export function newIdempotencyKey(prefix = "nq"): string {
  const rand =
    typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${rand}`;
}

export function idempotencyHeaders(key: string): Record<string, string> {
  return { "Idempotency-Key": key.slice(0, 128) };
}

/** Deterministic key for retries (no random suffix). */
export function stableIdempotencyKey(...parts: (string | number)[]): string {
  return parts.map(String).join("-").slice(0, 128);
}
