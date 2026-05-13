/**
 * useClipSync
 * ─────────────────────────────────────────────────────────────────────────────
 * Bridges the lesson's clip socket protocol (web parity) with React state for
 * the native clip-mode player. Subscribes to:
 *
 *   • ON_VIDEO_SELECT  → set active clip / clear
 *   • ON_VIDEO_PLAY_PAUSE → play/pause local <Video>
 *   • ON_VIDEO_TIME → seek the local <Video> to mirror trainer's playhead
 *   • ON_VIDEO_HIDE / ON_VIDEO_SHOW → toggle the live camera tiles visibility
 *
 * Trainer-side emitters mirror the names in `socketClient.js` so a trainer on
 * mobile and a trainee on web (or vice-versa) stay perfectly synchronised.
 *
 * The state-machine here intentionally keeps **no** clip metadata — it only
 * holds the currently-selected clip id and play state. The screen looks up the
 * actual clip object from `useTraineeClips` so we don't duplicate the source
 * of truth.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import { CLIP_EVENTS, type ClipUserInfo } from "./clipEvents";

type SeekHint = {
  videoId: string;
  progress: number;
  receivedAt: number;
} | null;

type Args = {
  socket: Socket | null;
  fromUserId: string;
  toUserId: string;
};

export function useClipSync({ socket, fromUserId, toUserId }: Args) {
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hideLocalCamera, setHideLocalCamera] = useState(false);
  const [seekHint, setSeekHint] = useState<SeekHint>(null);
  const lastSeekEmit = useRef(0);

  const userInfo: ClipUserInfo = { from_user: fromUserId, to_user: toUserId };

  useEffect(() => {
    if (!socket) return;

    const onSelect = (payload: any) => {
      const id = payload?.id ?? null;
      const type = payload?.type;
      if (type === "swap" && !id) {
        setActiveClipId(null);
        setIsPlaying(false);
        return;
      }
      setActiveClipId(id);
      setIsPlaying(false);
    };

    const onPlayPause = (payload: any) => {
      setIsPlaying(!!payload?.isPlaying);
    };

    const onTime = (payload: any) => {
      if (typeof payload?.progress !== "number") return;
      setSeekHint({
        videoId: payload.videoId,
        progress: payload.progress,
        receivedAt: Date.now(),
      });
    };

    const onHide = (payload: any) => {
      if (payload?.videoType === "live") setHideLocalCamera(true);
    };
    const onShow = (payload: any) => {
      if (payload?.videoType === "live") setHideLocalCamera(false);
    };

    socket.on(CLIP_EVENTS.ON_VIDEO_SELECT, onSelect);
    socket.on(CLIP_EVENTS.ON_VIDEO_PLAY_PAUSE, onPlayPause);
    socket.on(CLIP_EVENTS.ON_VIDEO_TIME, onTime);
    socket.on(CLIP_EVENTS.ON_VIDEO_HIDE, onHide);
    socket.on(CLIP_EVENTS.ON_VIDEO_SHOW, onShow);

    return () => {
      socket.off(CLIP_EVENTS.ON_VIDEO_SELECT, onSelect);
      socket.off(CLIP_EVENTS.ON_VIDEO_PLAY_PAUSE, onPlayPause);
      socket.off(CLIP_EVENTS.ON_VIDEO_TIME, onTime);
      socket.off(CLIP_EVENTS.ON_VIDEO_HIDE, onHide);
      socket.off(CLIP_EVENTS.ON_VIDEO_SHOW, onShow);
    };
  }, [socket]);

  /** Trainer broadcasts a clip id to play; trainee tracks it locally. */
  const selectClip = useCallback(
    (clipId: string | null) => {
      setActiveClipId(clipId);
      setIsPlaying(false);
      socket?.emit(CLIP_EVENTS.ON_VIDEO_SELECT, {
        type: clipId ? "clip" : "swap",
        id: clipId,
        userInfo,
      });
    },
    [socket, userInfo]
  );

  const togglePlay = useCallback(
    (next?: boolean) => {
      if (!activeClipId) return;
      const nextState = typeof next === "boolean" ? next : !isPlaying;
      setIsPlaying(nextState);
      socket?.emit(CLIP_EVENTS.ON_VIDEO_PLAY_PAUSE, {
        videoId: activeClipId,
        isPlaying: nextState,
        userInfo,
      });
    },
    [activeClipId, isPlaying, socket, userInfo]
  );

  /** Throttled seek emit — web throttles at ~5 emits / sec. */
  const seek = useCallback(
    (progressSeconds: number) => {
      if (!activeClipId) return;
      const now = Date.now();
      if (now - lastSeekEmit.current < 200) return;
      lastSeekEmit.current = now;
      socket?.emit(CLIP_EVENTS.ON_VIDEO_TIME, {
        videoId: activeClipId,
        progress: progressSeconds,
        userInfo,
      });
    },
    [activeClipId, socket, userInfo]
  );

  const hideLiveCamera = useCallback(
    (hidden: boolean) => {
      setHideLocalCamera(hidden);
      socket?.emit(hidden ? CLIP_EVENTS.ON_VIDEO_HIDE : CLIP_EVENTS.ON_VIDEO_SHOW, {
        videoType: "live",
        userInfo,
      });
    },
    [socket, userInfo]
  );

  return {
    activeClipId,
    isPlaying,
    hideLocalCamera,
    /** Latest playhead nudge from the trainer; consumer should debounce-seek. */
    seekHint,
    selectClip,
    togglePlay,
    seek,
    hideLiveCamera,
  };
}
