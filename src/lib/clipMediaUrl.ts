import { getS3ImageUrl } from "./imageUtils";

/** Same bucket as web `Utils.generateVideoURL` (portrait-calling / meeting). */
const S3_PROD_BASE = "https://netqwix-prod.s3.us-east-2.amazonaws.com/";

/** Share-email copies on R2 use the object key stored on the clip, not Mongo `_id`. */
const CLIP_R2_BASE = "https://pub-fffe76fa8765416caa3d396262faa16a.r2.dev/";

function isHttpUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("http://") || value.startsWith("https://"))
  );
}

function prodS3UrlFromFileKey(fileKey: string): string {
  const trimmed = fileKey.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const s3Key = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  return `${S3_PROD_BASE}${s3Key}`;
}

/**
 * Best-effort playback URL for a clip document returned by `/common/get-clips`
 * or `ON_VIDEO_SELECT` (prefer `playbackUrl` / `video_url` from the emitter).
 */
export function getClipPlaybackUrl(clip: any): string {
  if (!clip) return "";

  const direct =
    clip.playbackUrl ??
    clip.video_url ??
    clip.videoUrl ??
    clip.file_url ??
    clip.fileUrl ??
    clip.url ??
    clip.stream_url;
  if (isHttpUrl(direct)) return direct;

  const fileKey = clip.file_name ?? clip.filename ?? clip.file_id;
  if (fileKey != null && String(fileKey).trim() !== "") {
    return prodS3UrlFromFileKey(String(fileKey));
  }

  const fromHelper = getS3ImageUrl(fileKey);
  if (fromHelper) return fromHelper;

  const r2Key =
    clip.r2_key ?? clip.r2Key ?? clip.storage_key ?? clip.object_key ?? null;
  if (r2Key && String(r2Key).trim()) {
    const key = String(r2Key).replace(/^\//, "");
    return `${CLIP_R2_BASE}${key}`;
  }

  return "";
}

/**
 * Thumbnail URL — mirrors web `Utils.generateThumbnailURL` (always S3 prod bucket
 * for stored keys, not `data.netqwix.com`).
 */
export function getClipThumbnailUrl(clip: any): string {
  if (!clip) return "";

  const raw =
    clip.thumbnail ??
    clip.thumbnail_url ??
    clip.thumbnailUrl ??
    clip.poster ??
    clip.poster_url;
  if (raw == null || String(raw).trim() === "") return "";
  const thumb = String(raw).trim();
  if (isHttpUrl(thumb)) return thumb;
  return prodS3UrlFromFileKey(thumb);
}

export function isLikelyPdf(pathOrName?: string | null): boolean {
  if (!pathOrName) return false;
  return /\.pdf(\?|$)/i.test(String(pathOrName));
}
