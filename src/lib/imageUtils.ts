const S3_BASE = "https://netqwix-prod.s3.us-east-2.amazonaws.com/";

export function getS3ImageUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${S3_BASE}${url}`;
}
