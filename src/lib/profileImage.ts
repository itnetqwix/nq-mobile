import { getProfileImageUrl, getProfileImageUrlFallback } from "./imageUtils";

/** Pick a profile image key from API payloads (field names vary by endpoint). */
export function pickProfileImageKey(
  entity: unknown
): string | undefined {
  if (!entity || typeof entity !== "object") return undefined;
  const o = entity as Record<string, unknown>;
  const nested =
    o.senderId && typeof o.senderId === "object"
      ? (o.senderId as Record<string, unknown>)
      : o.receiverId && typeof o.receiverId === "object"
        ? (o.receiverId as Record<string, unknown>)
        : null;

  const candidates = [
    o.profile_picture,
    o.profilePicture,
    o.profile_image,
    o.profileImage,
    o.avatar,
    o.image,
    o.background_image,
    nested?.profile_picture,
    nested?.profilePicture,
  ];

  for (const raw of candidates) {
    if (typeof raw === "string") {
      const t = raw.trim();
      if (t && t !== "null" && t !== "undefined") return t;
    }
  }
  return undefined;
}

/** Resolved HTTPS URL for avatars (S3 / CDN / absolute passthrough). */
export function resolveProfileImageUrl(
  entityOrKey?: unknown
): string {
  if (entityOrKey == null) return "";
  if (typeof entityOrKey === "string") {
    return getProfileImageUrl(entityOrKey);
  }
  return getProfileImageUrl(pickProfileImageKey(entityOrKey));
}

/** Secondary URL when the primary host fails (CDN ↔ S3). */
export function resolveProfileImageFallback(
  entityOrKey?: unknown
): string {
  if (entityOrKey == null) return "";
  if (typeof entityOrKey === "string") {
    return getProfileImageUrlFallback(entityOrKey);
  }
  const key = pickProfileImageKey(entityOrKey);
  return key ? getProfileImageUrlFallback(key) : "";
}
