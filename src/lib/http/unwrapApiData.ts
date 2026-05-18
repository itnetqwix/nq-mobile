/** Unwrap axios / API envelopes: `{ data: T }`, `{ data: { data: T } }`, or raw `T`. */
export function unwrapApiData<T = unknown>(res: unknown): T {
  if (res == null || typeof res !== "object") return res as T;
  const root = res as Record<string, unknown>;
  const layer1 = root.data;
  if (layer1 != null && typeof layer1 === "object" && !Array.isArray(layer1)) {
    const inner = layer1 as Record<string, unknown>;
    if ("data" in inner && inner.data != null && typeof inner.data === "object") {
      return inner.data as T;
    }
    if (
      "skip" in inner ||
      "client_secret" in inner ||
      "valid" in inner ||
      "availableSlots" in inner ||
      "isAvailable" in inner
    ) {
      return inner as T;
    }
  }
  if (layer1 != null) return layer1 as T;
  return res as T;
}
