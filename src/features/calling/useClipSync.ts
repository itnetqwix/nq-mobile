/**
 * Clip socket sync — web `ON_VIDEO_SELECT` (type: clips | clip) + play/pause/seek/hide.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import { CLIP_EVENTS, type ClipUserInfo } from "./clipEvents";
import {
  clipIdOf,
  clipsFromSelectPayload,
  normalizeClipsFromSocket,
  primaryClipFromList,
  resolveClipPlayback,
  type ClipRecord,
} from "./clipSyncUtils";
import { getClipPlaybackUrl } from "../../lib/clipMediaUrl";

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

export type ClipLayoutMode = "default" | "clipFullscreen" | "stacked";

type Args = {
  socket: Socket | null;
  fromUserId: string;
  toUserId: string;
  sessionId?: string;
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

function applyClipsToState(
  clips: ClipRecord[],
  setSelectedClips: (c: ClipRecord[]) => void,
  setActiveClipId: (id: string | null) => void,
  setActiveClipUrl: (url: string | null) => void,
  setIsPlaying: (v: boolean) => void
) {
  setSelectedClips(clips);
  if (clips.length === 0) {
    setActiveClipId(null);
    setActiveClipUrl(null);
    setIsPlaying(false);
    return;
  }
  const primary = primaryClipFromList(clips);
  const { id, url } = resolveClipPlayback(primary);
  setActiveClipId(id);
  setActiveClipUrl(url);
  setIsPlaying(false);
}

export function useClipSync({
  socket,
  fromUserId,
  toUserId,
  sessionId,
  isTrainer = false,
}: Args) {
  const [selectedClips, setSelectedClips] = useState<ClipRecord[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [activeClipUrl, setActiveClipUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hiddenVideos, setHiddenVideos] = useState<HiddenVideosMap>(EMPTY_HIDDEN);
  const [seekHint, setSeekHint] = useState<SeekHint>(null);
  const [lockMode, setLockMode] = useState(false);
  const [layoutMode, setLayoutMode] = useState<ClipLayoutMode>("default");
  const [clipFullscreen, setClipFullscreen] = useState(false);
  const lastSeekEmit = useRef(0);
  const bookingPreloadedRef = useRef(false);

  const userInfo: ClipUserInfo = { from_user: fromUserId, to_user: toUserId };

  useEffect(() => {
    if (!socket) return;

    const onSelect = (payload: any) => {
      const type = payload?.type;

      if (type === "clips") {
        const clips = normalizeClipsFromSocket(clipsFromSelectPayload(payload));
        applyClipsToState(
          clips,
          setSelectedClips,
          setActiveClipId,
          setActiveClipUrl,
          setIsPlaying
        );
        return;
      }

      if (type === "swap" && !payload?.id) {
        setSelectedClips([]);
        setActiveClipId(null);
        setActiveClipUrl(null);
        setIsPlaying(false);
        return;
      }

      const id = payload?.id != null ? String(payload.id) : null;
      if (id) {
        const url =
          typeof payload?.playbackUrl === "string" && payload.playbackUrl
            ? payload.playbackUrl
            : getClipPlaybackUrl({ _id: id, ...payload }) || null;
        setSelectedClips(payload?.videos ?? [{ _id: id, video_url: url }]);
        setActiveClipId(id);
        setActiveClipUrl(url);
        setIsPlaying(false);
        return;
      }

      setSelectedClips([]);
      setActiveClipId(null);
      setActiveClipUrl(null);
      setIsPlaying(false);
    };

    const onPlayPause = (payload: any) => {
      setIsPlaying(!!payload?.isPlaying);
    };

    const onTime = (payload: any) => {
      if (typeof payload?.progress !== "number") return;
      setSeekHint({
        videoId: String(payload.videoId ?? activeClipId ?? ""),
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

    const onLockMode = (payload: any) => {
      setLockMode(!!payload?.locked);
    };

    const onFullscreen = (payload: any) => {
      const on = !!payload?.isFullscreen;
      const mode = payload?.layoutMode as ClipLayoutMode | undefined;
      setClipFullscreen(on);
      setLayoutMode(
        mode === "clipFullscreen" || mode === "stacked" || mode === "default"
          ? mode
          : on
            ? "clipFullscreen"
            : "default"
      );
    };

    socket.on(CLIP_EVENTS.ON_VIDEO_SELECT, onSelect);
    socket.on(CLIP_EVENTS.ON_VIDEO_PLAY_PAUSE, onPlayPause);
    socket.on(CLIP_EVENTS.ON_VIDEO_TIME, onTime);
    socket.on(CLIP_EVENTS.ON_VIDEO_HIDE, onHide);
    socket.on(CLIP_EVENTS.ON_VIDEO_SHOW, onShow);
    socket.on(CLIP_EVENTS.TOGGLE_LOCK_MODE, onLockMode);
    socket.on(CLIP_EVENTS.TOGGLE_FULL_SCREEN, onFullscreen);

    return () => {
      socket.off(CLIP_EVENTS.ON_VIDEO_SELECT, onSelect);
      socket.off(CLIP_EVENTS.ON_VIDEO_PLAY_PAUSE, onPlayPause);
      socket.off(CLIP_EVENTS.ON_VIDEO_TIME, onTime);
      socket.off(CLIP_EVENTS.ON_VIDEO_HIDE, onHide);
      socket.off(CLIP_EVENTS.ON_VIDEO_SHOW, onShow);
      socket.off(CLIP_EVENTS.TOGGLE_LOCK_MODE, onLockMode);
      socket.off(CLIP_EVENTS.TOGGLE_FULL_SCREEN, onFullscreen);
    };
  }, [socket, activeClipId]);

  const emitSelectClips = useCallback(
    (clips: ClipRecord[], options?: { emitSocket?: boolean }) => {
      // Either side may drive clip selection (trainee shares booking clips to trainer on mobile).
      const shouldEmit = options?.emitSocket !== false && !!socket;
      const normalized = normalizeClipsFromSocket(clips);
      applyClipsToState(
        normalized,
        setSelectedClips,
        setActiveClipId,
        setActiveClipUrl,
        setIsPlaying
      );
      if (!shouldEmit) return;
      socket!.emit(CLIP_EVENTS.ON_VIDEO_SELECT, {
        type: "clips",
        videos: normalized,
        userInfo,
        sessionId,
      });
    },
    [socket, userInfo, sessionId]
  );

  const selectClip = useCallback(
    (clipId: string | null, playbackUrl?: string | null, clipObject?: ClipRecord | null) => {
      if (!clipId) {
        emitSelectClips([]);
        return;
      }
      const clip: ClipRecord =
        clipObject ??
        ({
          _id: clipId,
          video_url: playbackUrl ?? undefined,
        } as ClipRecord);
      const url = playbackUrl ?? getClipPlaybackUrl(clip) ?? null;
      emitSelectClips([{ ...clip, _id: clipId, video_url: url, playbackUrl: url }]);
    },
    [emitSelectClips]
  );

  const preloadBookingClips = useCallback(
    (clips: ClipRecord[]) => {
      if (bookingPreloadedRef.current || clips.length === 0) return;
      bookingPreloadedRef.current = true;
      const playable = clips.filter((c) => resolveClipPlayback(c).url);
      if (playable.length === 0) return;
      emitSelectClips(playable, { emitSocket: true });
    },
    [emitSelectClips]
  );

  const togglePlay = useCallback(
    (next?: boolean) => {
      if (!activeClipId) return;
      const nextState = typeof next === "boolean" ? next : !isPlaying;
      setIsPlaying(nextState);
      if (!isTrainer || !socket) return;
      socket.emit(CLIP_EVENTS.ON_VIDEO_PLAY_PAUSE, {
        videoId: activeClipId,
        isPlaying: nextState,
        both: lockMode,
        userInfo,
      });
    },
    [activeClipId, isPlaying, isTrainer, lockMode, socket, userInfo]
  );

  const seek = useCallback(
    (progressSeconds: number, options?: { forceEmit?: boolean }) => {
      if (!activeClipId) return;
      const now = Date.now();
      setSeekHint({
        videoId: activeClipId,
        progress: progressSeconds,
        receivedAt: now,
      });
      if (!isTrainer || !socket) return;
      if (!options?.forceEmit && now - lastSeekEmit.current < 200) return;
      lastSeekEmit.current = now;
      socket.emit(CLIP_EVENTS.ON_VIDEO_TIME, {
        videoId: activeClipId,
        progress: progressSeconds,
        both: lockMode,
        userInfo,
      });
    },
    [activeClipId, isTrainer, lockMode, socket, userInfo]
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

  const toggleLockMode = useCallback(() => {
    const next = !lockMode;
    setLockMode(next);
    if (!isTrainer || !socket) return;
    socket.emit(CLIP_EVENTS.TOGGLE_LOCK_MODE, {
      locked: next,
      userInfo,
      sessionId,
    });
  }, [isTrainer, lockMode, socket, userInfo, sessionId]);

  const toggleClipFullscreen = useCallback(() => {
    const next = !clipFullscreen;
    setClipFullscreen(next);
    setLayoutMode(next ? "clipFullscreen" : "default");
    if (!isTrainer || !socket) return;
    socket.emit(CLIP_EVENTS.TOGGLE_FULL_SCREEN, {
      isFullscreen: next,
      userInfo,
      sessionId,
    });
  }, [clipFullscreen, isTrainer, socket, userInfo, sessionId]);

  const setLayout = useCallback(
    (mode: ClipLayoutMode) => {
      setLayoutMode(mode);
      const fs = mode === "clipFullscreen";
      setClipFullscreen(fs);
      if (!isTrainer || !socket) return;
      socket.emit(CLIP_EVENTS.TOGGLE_FULL_SCREEN, {
        isFullscreen: fs,
        layoutMode: mode,
        userInfo,
        sessionId,
      });
    },
    [isTrainer, socket, userInfo, sessionId]
  );

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
    selectedClips,
    activeClipId,
    activeClipUrl,
    isPlaying,
    hiddenVideos,
    hideLocalCamera,
    seekHint,
    lockMode,
    layoutMode,
    clipFullscreen,
    selectClip,
    emitSelectClips,
    preloadBookingClips,
    togglePlay,
    seek,
    setVideoHidden,
    hideLiveCamera,
    toggleLockMode,
    toggleClipFullscreen,
    setLayout,
  };
}
