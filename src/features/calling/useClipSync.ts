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
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import { CLIP_EVENTS, type ClipUserInfo } from "./clipEvents";

type SeekHint = {
  videoId: string;
  progress: number;
  receivedAt: number;
} | null;

export type HiddenVideosMap = {
  teacher: boolean;
  student: boolean;
};

export type VideoHideType = "teacher" | "student" | "live";

type Args = {
  socket: Socket | null;
  fromUserId: string;
  toUserId: string;
  sessionId?: string;
  /** When true, hide/show emits are sent to the peer. */
  isTrainer?: boolean;
};

const EMPTY_HIDDEN: HiddenVideosMap = { teacher: false, student: false };

function applyVideoTypeHide(
  prev: HiddenVideosMap,
  videoType: string,
  hidden: boolean
): HiddenVideosMap {
  if (videoType === "live") {
    return { teacher: hidden, student: hidden };
  }
  if (videoType === "teacher") {
    return { ...prev, teacher: hidden };
  }
  if (videoType === "student") {
    return { ...prev, student: hidden };
  }
  return prev;
}

export function useClipSync({
  socket,
  fromUserId,
  toUserId,
  sessionId,
  isTrainer = false,
}: Args) {
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [activeClipUrl, setActiveClipUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hiddenVideos, setHiddenVideos] = useState<HiddenVideosMap>(EMPTY_HIDDEN);
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
        setActiveClipUrl(null);
        setIsPlaying(false);
        return;
      }
      setActiveClipId(id);
      if (typeof payload?.playbackUrl === "string" && payload.playbackUrl) {
        setActiveClipUrl(payload.playbackUrl);
      }
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
      const videoType = payload?.videoType;
      if (!videoType) return;
      setHiddenVideos((prev) => applyVideoTypeHide(prev, String(videoType), true));
    };

    const onShow = (payload: any) => {
      const videoType = payload?.videoType;
      if (!videoType) return;
      setHiddenVideos((prev) => applyVideoTypeHide(prev, String(videoType), false));
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

  const selectClip = useCallback(
    (clipId: string | null, playbackUrl?: string | null) => {
      setActiveClipId(clipId);
      setActiveClipUrl(playbackUrl ?? null);
      setIsPlaying(false);
      socket?.emit(CLIP_EVENTS.ON_VIDEO_SELECT, {
        type: clipId ? "clip" : "swap",
        id: clipId,
        playbackUrl: playbackUrl ?? undefined,
        userInfo,
        sessionId,
      });
    },
    [socket, userInfo, sessionId]
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

  const seek = useCallback(
    (progressSeconds: number) => {
      if (!activeClipId) return;
      const now = Date.now();
      setSeekHint({
        videoId: activeClipId,
        progress: progressSeconds,
        receivedAt: now,
      });
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

  const setVideoHidden = useCallback(
    (videoType: VideoHideType, hidden: boolean) => {
      setHiddenVideos((prev) => applyVideoTypeHide(prev, videoType, hidden));
      if (!isTrainer || !socket) return;
      socket.emit(hidden ? CLIP_EVENTS.ON_VIDEO_HIDE : CLIP_EVENTS.ON_VIDEO_SHOW, {
        videoType,
        userInfo,
        sessionId,
      });
    },
    [isTrainer, socket, userInfo, sessionId]
  );

  /** @deprecated Use setVideoHidden('live', hidden) */
  const hideLiveCamera = useCallback(
    (hidden: boolean) => {
      setVideoHidden("live", hidden);
    },
    [setVideoHidden]
  );

  const hideLocalCamera =
    hiddenVideos.teacher && hiddenVideos.student
      ? true
      : hiddenVideos.teacher || hiddenVideos.student;

  return {
    activeClipId,
    activeClipUrl,
    isPlaying,
    hiddenVideos,
    hideLocalCamera,
    seekHint,
    selectClip,
    togglePlay,
    seek,
    setVideoHidden,
    hideLiveCamera,
  };
}
