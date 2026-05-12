import { getS3ImageUrl } from "./imageUtils";

/** Backend share-email uses R2 public URLs keyed by clip id (see `userService.shareClips`). */
const CLIP_R2_BASE = "https://pub-fffe76fa8765416caa3d396262faa16a.r2.dev/";

/**
 * Best-effort playback URL for a clip document returned by `/common/get-clips`.
 * Prefer explicit URLs, then S3 `file_name`, then R2 by id (web parity).
 */
export function getClipPlaybackUrl(clip: any): string {
  if (!clip) return "";
  const direct =
    clip.video_url ??
    clip.videoUrl ??
    clip.file_url ??
    clip.fileUrl ??
    clip.url ??
    clip.stream_url;
  if (typeof direct === "string" && (direct.startsWith("http://") || direct.startsWith("https://"))) {
    return direct;
  }
  const fromFile = getS3ImageUrl(clip.file_name ?? clip.filename ?? clip.file_id);
  if (fromFile) return fromFile;
  if (clip._id) return `${CLIP_R2_BASE}${clip._id}`;
  return "";
}

export function isLikelyPdf(pathOrName?: string | null): boolean {
  if (!pathOrName) return false;
  return /\.pdf(\?|$)/i.test(String(pathOrName));
}
