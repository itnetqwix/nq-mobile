const S3_BASE = "https://netqwix-prod.s3.us-east-2.amazonaws.com/";
const DATA_CDN_BASE = "https://data.netqwix.com/";

/** Resolve stored asset keys to a fetchable URL (S3, data CDN, or passthrough). */
export function getS3ImageUrl(url?: string | null): string {
  if (!url) return "";
  const raw = String(url).trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("file://")) {
    return raw;
  }
  if (raw.startsWith("data.netqwix.com/")) {
    return `https://${raw}`;
  }
  if (raw.startsWith("/")) {
    return `${DATA_CDN_BASE}${raw.replace(/^\//, "")}`;
  }
  if (raw.startsWith("chat-media/")) {
    return `${S3_BASE}${raw}`;
  }
  // Profile uploads are stored as `timestamp.ext` on data.netqwix.com
  if (!raw.includes("/")) {
    return `${DATA_CDN_BASE}${raw}`;
  }
  return `${S3_BASE}${raw}`;
}
