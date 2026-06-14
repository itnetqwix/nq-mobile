export const SHARE_MY_CLIPS = "My Clips" as const;
export const SHARE_FRIENDS = "Friends" as const;
export const SHARE_EMAIL = "Email" as const;
/** Backend `clipConfirmService` wire value for email invites. */
export const SHARE_BACKEND_NEW_USERS = "New Users" as const;

export type CaptureShareTarget = "my-clips" | "friends" | "email";

export type ClipShareTargetWire =
  | typeof SHARE_MY_CLIPS
  | typeof SHARE_FRIENDS
  | typeof SHARE_EMAIL;

export function shareTargetToWire(target: CaptureShareTarget): ClipShareTargetWire {
  if (target === "friends") return SHARE_FRIENDS;
  if (target === "email") return SHARE_EMAIL;
  return SHARE_MY_CLIPS;
}

export function shareTargetTitleKey(target: CaptureShareTarget): string {
  if (target === "friends") return "capture.uploadTitleFriends";
  if (target === "email") return "capture.uploadTitleEmail";
  return "capture.uploadTitleLibrary";
}

export function shareTargetSubtitleKey(target: CaptureShareTarget): string {
  if (target === "friends") return "capture.uploadSubtitleFriends";
  if (target === "email") return "capture.uploadSubtitleEmail";
  return "capture.uploadSubtitleLibrary";
}
