import { getS3ImageUrl } from "../../../lib/imageUtils";

export type ChatMediaItem = {
  id: string;
  uri: string;
  type: "image" | "video";
  createdAt: string;
};

export function resolveChatMediaUri(mediaUrl?: string | null): string | null {
  if (!mediaUrl) return null;
  if (mediaUrl.startsWith("http") || mediaUrl.startsWith("file")) return mediaUrl;
  return getS3ImageUrl(mediaUrl) ?? null;
}

export function buildChatMediaList(
  messages: Array<{ _id: string; type: string; mediaUrl?: string | null; createdAt: string }>
): ChatMediaItem[] {
  return messages
    .filter((m) => (m.type === "image" || m.type === "video") && m.mediaUrl)
    .map((m) => {
      const uri = resolveChatMediaUri(m.mediaUrl)!;
      return {
        id: m._id,
        uri,
        type: m.type as "image" | "video",
        createdAt: m.createdAt,
      };
    })
    .filter((x) => !!x.uri);
}
