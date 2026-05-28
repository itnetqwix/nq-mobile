const S3_BASE = "https://netqwix-prod.s3.us-east-2.amazonaws.com/";
const DATA_CDN_BASE = "https://data.netqwix.com/";

function trimKey(url?: string | null): string {
  if (!url) return "";
  return String(url).trim();
}

/** Build S3 prod URL for a stored object key (web `Utils.getImageUrlOfS3` parity). */
export function s3ProdUrl(key: string): string {
  const objectKey = key.replace(/^\/+/, "");
  return `${S3_BASE}${objectKey}`;
}

/** Build data CDN URL for a stored key. */
export function dataCdnUrl(key: string): string {
  const objectKey = key.replace(/^\/+/, "");
  return `${DATA_CDN_BASE}${objectKey}`;
}

/**
 * Resolve stored asset keys to a fetchable URL (S3, data CDN, or passthrough).
 * Profile pictures and bucket-root keys use the **S3 prod** host (same as web).
 */
export function getS3ImageUrl(url?: string | null): string {
  return getProfileImageUrl(url);
}

/**
 * Primary profile / asset URL. Prefer this over legacy `getS3ImageUrl` naming.
 */
export function getProfileImageUrl(url?: string | null): string {
  const raw = trimKey(url);
  if (!raw) return "";
  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("file://")
  ) {
    return raw;
  }
  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }
  if (raw.startsWith("data.netqwix.com/")) {
    return `https://${raw}`;
  }
  if (raw.startsWith("/")) {
    return dataCdnUrl(raw);
  }
  if (raw.startsWith("chat-media/")) {
    return s3ProdUrl(raw);
  }
  // `timestamp.jpg` profile uploads and most keys live at the S3 bucket root (web parity).
  if (!raw.includes("/")) {
    return s3ProdUrl(raw);
  }
  return s3ProdUrl(raw);
}

/**
 * Alternate host when the primary URL 404s (bare keys exist on both CDN and S3 in some envs).
 */
export function getProfileImageUrlFallback(url?: string | null): string {
  const raw = trimKey(url);
  if (!raw || raw.startsWith("http://") || raw.startsWith("https://")) {
    return "";
  }
  const primary = getProfileImageUrl(raw);
  if (!raw.includes("/")) {
    const alt = dataCdnUrl(raw);
    return alt !== primary ? alt : "";
  }
  if (primary.startsWith(DATA_CDN_BASE)) {
    return s3ProdUrl(raw.replace(/^\//, ""));
  }
  return "";
}

/** @deprecated Use {@link getProfileImageUrl} */
export function getImageUrl(url?: string | null): string {
  return getProfileImageUrl(url);
}
