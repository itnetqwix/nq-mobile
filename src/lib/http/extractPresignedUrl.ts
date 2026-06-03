/** Presigned PUT URL from axios body (`{ url }`, `{ data: { url } }`, or `{ success, url }`). */
export function extractPresignedPutUrl(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  if (typeof root.url === "string" && root.url.trim()) return root.url.trim();
  const nested = root.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const url = (nested as Record<string, unknown>).url;
    if (typeof url === "string" && url.trim()) return url.trim();
  }
  const result = root.result;
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const url = (result as Record<string, unknown>).url;
    if (typeof url === "string" && url.trim()) return url.trim();
  }
  return null;
}

export function extractPresignedFilename(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  if (typeof root.filename === "string" && root.filename.trim()) {
    return root.filename.trim();
  }
  const nested = root.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const filename = (nested as Record<string, unknown>).filename;
    if (typeof filename === "string" && filename.trim()) return filename.trim();
  }
  return null;
}
