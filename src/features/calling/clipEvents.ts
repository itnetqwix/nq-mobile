/**
 * Clip / drawing socket events used during a lesson. Wire names match
 * `nq-frontend-main/helpers/events.ts` so trainer (web) ↔ trainee (mobile) and
 * any future mobile ↔ mobile combinations all stay in sync.
 */
export const CLIP_EVENTS = {
  /** Trainer selects which clip is "on the big screen" or swaps layout. */
  ON_VIDEO_SELECT: "ON_VIDEO_SELECT",
  ON_VIDEO_SHOW: "ON_VIDEO_SHOW",
  ON_VIDEO_HIDE: "ON_VIDEO_HIDE",
  ON_VIDEO_PLAY_PAUSE: "ON_VIDEO_PLAY_PAUSE",
  ON_VIDEO_TIME: "ON_VIDEO_TIME",
  TOGGLE_DRAWING_MODE: "TOGGLE_DRAWING_MODE",
  TOGGLE_FULL_SCREEN: "TOGGLE_FULL_SCREEN",
  TOGGLE_LOCK_MODE: "TOGGLE_LOCK_MODE",
  ON_CLEAR_CANVAS: "ON_CLEAR_CANVAS",
  ON_VIDEO_ZOOM_PAN: "ON_VIDEO_ZOOM_PAN",
} as const;

export type ClipUserInfo = {
  from_user: string;
  to_user: string;
};

/** Payload that travels over `ON_VIDEO_SELECT`. */
export type ClipSelectPayload = {
  type: "swap" | "clip" | string;
  id: string | null;
  userInfo: ClipUserInfo;
};

/** Payload that travels over `ON_VIDEO_PLAY_PAUSE`. */
export type ClipPlayPausePayload = {
  videoId: string;
  isPlaying: boolean;
  both?: boolean;
  userInfo: ClipUserInfo;
};

/** Payload that travels over `ON_VIDEO_TIME`. */
export type ClipSeekPayload = {
  videoId: string;
  progress: number;
  both?: boolean;
  userInfo: ClipUserInfo;
};
