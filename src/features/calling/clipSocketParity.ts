/**
 * Normalize clip socket payloads from web (`nq-frontend-main`) and mobile.
 */

import type { ClipUserInfo } from "./clipEvents";

export type PlayPauseEmitArgs = {
  isPlaying: boolean;
  both: boolean;
  videoId?: string | null;
  userInfo: ClipUserInfo;
  sessionId?: string;
};

/** Emit shape understood by web clip-mode and legacy video.jsx handlers. */
export function buildPlayPauseEmitPayload(args: PlayPauseEmitArgs): Record<string, unknown> {
  const { isPlaying, both, videoId, userInfo, sessionId } = args;
  if (both) {
    return {
      both: true,
      number: "all",
      isPlaying,
      isPlayingAll: isPlaying,
      userInfo,
      sessionId,
    };
  }
  return {
    both: false,
    videoId: videoId ?? undefined,
    isPlaying,
    userInfo,
    sessionId,
  };
}

export function clipIndexFromLegacyNumber(payload: Record<string, unknown>): 0 | 1 | null {
  const n = payload.number;
  if (n === "one" || n === 1 || n === "1") return 0;
  if (n === "two" || n === 2 || n === "2") return 1;
  return null;
}

export function clipIdFromPayload(payload: Record<string, unknown>): string | null {
  const raw =
    payload.videoId ??
    payload.id ??
    payload.clipId ??
    payload.clip_id;
  if (raw == null || raw === "") return null;
  return String(raw);
}

export function isBothClipsPayload(payload: Record<string, unknown>, lockMode: boolean): boolean {
  if (lockMode) return true;
  if (payload.both === true) return true;
  if (payload.number === "all" || payload.number === "both") return true;
  return false;
}

export function playStateFromPayload(payload: Record<string, unknown>): boolean {
  if (typeof payload.isPlaying === "boolean") return payload.isPlaying;
  if (typeof payload.isPlayingAll === "boolean") return payload.isPlayingAll;
  if (payload.action === "play") return true;
  if (payload.action === "pause") return false;
  return false;
}

export function seekProgressFromPayload(payload: Record<string, unknown>): number | null {
  const raw =
    payload.progress ??
    payload.clickedTime ??
    payload.time ??
    payload.currentTime;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return raw;
}

export function isRemotePeerEvent(
  payload: { userInfo?: ClipUserInfo; sessionId?: string },
  opts: { sessionId?: string; myUserId: string }
): boolean {
  if (
    opts.sessionId &&
    payload.sessionId != null &&
    String(payload.sessionId) !== String(opts.sessionId)
  ) {
    return false;
  }
  const from = payload?.userInfo?.from_user;
  if (from && String(from) === String(opts.myUserId)) return false;
  return true;
}
