import { getS3ImageUrl } from "../../../lib/imageUtils";
import { getClipPlaybackUrl } from "../../../lib/clipMediaUrl";

const CLIP_R2_BASE = "https://pub-fffe76fa8765416caa3d396262faa16a.r2.dev/";
const DATA_CDN_BASE = "https://data.netqwix.com/";

export type ChatMediaKind = "image" | "video";

export type ChatMediaItem = {
  id: string;
  uri: string;
  type: ChatMediaKind;
  createdAt: string;
};

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|quicktime)(\?|$)/i;
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i;
const MONGO_ID = /^[a-f0-9]{24}$/i;

/** Normalize chat `type` + URL into image vs video (handles legacy `clip` messages). */
export function inferChatMediaKind(
  type: string,
  mediaUrl?: string | null
): ChatMediaKind | null {
  const t = String(type ?? "").toLowerCase();
  if (t === "image") return "image";
  if (t === "video" || t === "clip") return "video";
  if (!mediaUrl) return null;
  const url = mediaUrl.toLowerCase();
  if (VIDEO_EXT.test(url)) return "video";
  if (IMAGE_EXT.test(url)) return "image";
  if (MONGO_ID.test(mediaUrl)) return "video";
  return null;
}

export function resolveChatMediaUri(mediaUrl?: string | null): string | null {
  if (!mediaUrl) return null;
  const raw = String(mediaUrl).trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("file://")) {
    return raw;
  }
  if (MONGO_ID.test(raw)) {
    return `${CLIP_R2_BASE}${raw}`;
  }
  if (raw.startsWith("data.netqwix.com/")) {
    return `https://${raw}`;
  }
  if (raw.startsWith("/")) {
    return `${DATA_CDN_BASE}${raw.replace(/^\//, "")}`;
  }
  const s3 = getS3ImageUrl(raw);
  if (s3) return s3;
  return getClipPlaybackUrl({ _id: raw, file_name: raw }) || null;
}

export function buildChatMediaList(
  messages: Array<{ _id: string; type: string; mediaUrl?: string | null; createdAt: string }>
): ChatMediaItem[] {
  return messages
    .map((m) => {
      const kind = inferChatMediaKind(m.type, m.mediaUrl);
      if (!kind || !m.mediaUrl) return null;
      const uri = resolveChatMediaUri(m.mediaUrl);
      if (!uri) return null;
      return {
        id: m._id,
        uri,
        type: kind,
        createdAt: m.createdAt,
      };
    })
    .filter((x): x is ChatMediaItem => x != null);
}
