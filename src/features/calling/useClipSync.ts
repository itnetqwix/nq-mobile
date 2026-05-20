/**
 * Clip socket sync — web `ON_VIDEO_SELECT` (type: clips | clip) + play/pause/seek/hide.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import {
  buildFullscreenPayload,
  CLIP_EVENTS,
  shouldApplyRemoteSocketEvent,
  type ClipUserInfo,
} from "./clipEvents";
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

type ZoomPan = { zoom: number; pan: { x: number; y: number } };

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
  /** Shared timeline anchor when dual clips are locked (seconds). */
  const [lockPoint, setLockPoint] = useState(0);
  const [layoutMode, setLayoutMode] = useState<ClipLayoutMode>("default");
  const [clipFullscreen, setClipFullscreen] = useState(false);
  /** Which dual-clip pane is expanded (0 | 1), or null for split view. */
  const [clipFocusIndex, setClipFocusIndex] = useState<0 | 1 | null>(null);
  const [zoomPanByVideoId, setZoomPanByVideoId] = useState<Record<string, ZoomPan>>({});
  const lastSeekEmit = useRef(0);
  const bookingPreloadedRef = useRef(false);
  const lockModeRef = useRef(false);
  const pendingPlayAfterLockRef = useRef<boolean | null>(null);

  const userInfo: ClipUserInfo = { from_user: fromUserId, to_user: toUserId };

  useEffect(() => {
    if (!socket) return;

    const onSelect = (payload: any) => {
      const type = payload?.type;

      if (type === "clips") {
        const clips = normalizeClipsFromSocket(clipsFromSelectPayload(payload)).slice(0, 2);
        applyClipsToState(
          clips,
          setSelectedClips,
          setActiveClipId,
          setActiveClipUrl,
          setIsPlaying
        );
        if (clips.length < 2) {
          setLockMode(false);
        }
        return;
      }

      // Live-stream focus (`type: "swap"`) is handled by useMeetingLayout — do not clear clips.
      if (type === "swap") return;

      const id = payload?.id != null ? String(payload.id) : null;
      if (id && type === "clip") {
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
      const both = !!(payload?.both || lockModeRef.current);
      if (both) {
        const nextPlaying = !!payload?.isPlaying;
        if (lockModeRef.current && pendingPlayAfterLockRef.current == null) {
          pendingPlayAfterLockRef.current = nextPlaying;
        }
        setIsPlaying(nextPlaying);
        return;
      }
      const vid = payload?.videoId != null ? String(payload.videoId) : null;
      if (!vid || vid === activeClipId) {
        setIsPlaying(!!payload?.isPlaying);
      }
    };

    const onTime = (payload: any) => {
      if (typeof payload?.progress !== "number") return;
      const both = !!(payload?.both || lockModeRef.current);
      if (both) {
        setSeekHint({
          videoId: "",
          progress: payload.progress,
          receivedAt: Date.now(),
        });
        return;
      }
      const vid = payload?.videoId != null ? String(payload.videoId) : null;
      if (!vid || vid === activeClipId) {
        setSeekHint({
          videoId: vid ?? "",
          progress: payload.progress,
          receivedAt: Date.now(),
        });
      }
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
      const nextLocked = !!(payload?.locked ?? payload?.isLockMode);
      lockModeRef.current = nextLocked;
      setLockMode(nextLocked);
      if (!nextLocked) {
        setLockPoint(0);
        pendingPlayAfterLockRef.current = null;
        return;
      }
      if (typeof payload?.lockPoint === "number" && Number.isFinite(payload.lockPoint)) {
        setLockPoint(payload.lockPoint);
        setSeekHint({
          videoId: "",
          progress: payload.lockPoint,
          receivedAt: Date.now(),
        });
      }
      const pending = pendingPlayAfterLockRef.current;
      if (pending != null) {
        pendingPlayAfterLockRef.current = null;
        setIsPlaying(pending);
      }
    };

    const onFullscreen = (payload: any) => {
      if (
        !shouldApplyRemoteSocketEvent(payload, {
          sessionId,
          myUserId: fromUserId,
          isTrainer,
        })
      ) {
        return;
      }
      const on = !!(payload?.isFullscreen ?? payload?.isMaximized);
      const mode = payload?.layoutMode as ClipLayoutMode | undefined;
      const idx = payload?.clipIndex;
      if (idx === 0 || idx === 1) {
        setClipFocusIndex(on ? idx : null);
      } else if (!on) {
        setClipFocusIndex(null);
      }
      setClipFullscreen(on);
      setLayoutMode(
        mode === "clipFullscreen" || mode === "stacked" || mode === "default"
          ? mode
          : on
            ? "clipFullscreen"
            : "default"
      );
    };

    const onZoomPan = (payload: any) => {
      const videoId = String(payload?.videoId ?? payload?.clipId ?? "");
      if (!videoId) return;
      if (payload?.sessionId != null && String(payload.sessionId) !== String(sessionId)) return;
      const from = String(payload?.userInfo?.from_user ?? "");
      if (from && from === String(fromUserId)) return; // ignore our own echo
      const zoom = typeof payload?.zoom === "number" ? payload.zoom : NaN;
      const pan = payload?.pan;
      setZoomPanByVideoId((prev) => {
        const cur = prev[videoId] ?? { zoom: 1, pan: { x: 0, y: 0 } };
        return {
          ...prev,
          [videoId]: {
            zoom: Number.isFinite(zoom) ? Math.max(1, Math.min(5, zoom)) : cur.zoom,
            pan:
              pan && typeof pan.x === "number" && typeof pan.y === "number"
                ? { x: pan.x, y: pan.y }
                : cur.pan,
          },
        };
      });
    };

    socket.on(CLIP_EVENTS.ON_VIDEO_SELECT, onSelect);
    socket.on(CLIP_EVENTS.ON_VIDEO_PLAY_PAUSE, onPlayPause);
    socket.on(CLIP_EVENTS.ON_VIDEO_TIME, onTime);
    socket.on(CLIP_EVENTS.ON_VIDEO_HIDE, onHide);
    socket.on(CLIP_EVENTS.ON_VIDEO_SHOW, onShow);
    socket.on(CLIP_EVENTS.TOGGLE_LOCK_MODE, onLockMode);
    socket.on(CLIP_EVENTS.TOGGLE_FULL_SCREEN, onFullscreen);
    socket.on(CLIP_EVENTS.ON_VIDEO_ZOOM_PAN, onZoomPan);

    return () => {
      socket.off(CLIP_EVENTS.ON_VIDEO_SELECT, onSelect);
      socket.off(CLIP_EVENTS.ON_VIDEO_PLAY_PAUSE, onPlayPause);
      socket.off(CLIP_EVENTS.ON_VIDEO_TIME, onTime);
      socket.off(CLIP_EVENTS.ON_VIDEO_HIDE, onHide);
      socket.off(CLIP_EVENTS.ON_VIDEO_SHOW, onShow);
      socket.off(CLIP_EVENTS.TOGGLE_LOCK_MODE, onLockMode);
      socket.off(CLIP_EVENTS.TOGGLE_FULL_SCREEN, onFullscreen);
      socket.off(CLIP_EVENTS.ON_VIDEO_ZOOM_PAN, onZoomPan);
    };
  }, [socket, activeClipId, sessionId, fromUserId, isTrainer]);

  const emitZoomPan = useCallback(
    (videoId: string, zoom: number, pan: { x: number; y: number }) => {
      if (!socket || !sessionId || !videoId) return;
      socket.emit(CLIP_EVENTS.ON_VIDEO_ZOOM_PAN, {
        videoId,
        zoom,
        pan,
        userInfo,
        sessionId,
      });
    },
    [socket, sessionId, userInfo]
  );

  const bumpZoom = useCallback(
    (videoId: string, delta: number) => {
      if (!videoId) return;
      setZoomPanByVideoId((prev) => {
        const cur = prev[String(videoId)] ?? { zoom: 1, pan: { x: 0, y: 0 } };
        const nextZoom = Math.max(1, Math.min(5, cur.zoom + delta));
        const next = { ...prev, [String(videoId)]: { ...cur, zoom: nextZoom } };
        if (isTrainer) emitZoomPan(String(videoId), nextZoom, cur.pan);
        return next;
      });
    },
    [emitZoomPan, isTrainer]
  );

  const clearLockMode = useCallback(
    (emitSocket: boolean) => {
      lockModeRef.current = false;
      setLockMode(false);
      pendingPlayAfterLockRef.current = null;
      if (!emitSocket || !socket || !isTrainer) return;
      socket.emit(CLIP_EVENTS.TOGGLE_LOCK_MODE, {
        locked: false,
        isLockMode: false,
        lockPoint: 0,
        userInfo,
        sessionId,
      });
    },
    [isTrainer, sessionId, socket, userInfo]
  );

  const emitSelectClips = useCallback(
    (clips: ClipRecord[], options?: { emitSocket?: boolean }) => {
      // Either side may drive clip selection (trainee shares booking clips to trainer on mobile).
      const shouldEmit = options?.emitSocket !== false && !!socket;
      const normalized = normalizeClipsFromSocket(clips).slice(0, 2);
      applyClipsToState(
        normalized,
        setSelectedClips,
        setActiveClipId,
        setActiveClipUrl,
        setIsPlaying
      );
      if (normalized.length < 2) {
        clearLockMode(shouldEmit);
      }
      if (!shouldEmit) return;
      socket!.emit(CLIP_EVENTS.ON_VIDEO_SELECT, {
        type: "clips",
        videos: normalized,
        userInfo,
        sessionId,
      });
    },
    [clearLockMode, socket, userInfo, sessionId]
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
      const playable = clips.filter((c) => resolveClipPlayback(c).url).slice(0, 2);
      if (playable.length === 0) return;
      emitSelectClips(playable, { emitSocket: true });
    },
    [emitSelectClips]
  );

  const togglePlay = useCallback(
    (next?: boolean, videoIdOverride?: string | null) => {
      const bothLocked = lockMode && selectedClips.length >= 2;
      const vid =
        videoIdOverride ??
        activeClipId ??
        (selectedClips[0] ? clipIdOf(selectedClips[0]) : null);
      if (!vid && !bothLocked) return;
      const nextState = typeof next === "boolean" ? next : !isPlaying;
      setIsPlaying(nextState);
      if (!isTrainer || !socket) return;
      socket.emit(CLIP_EVENTS.ON_VIDEO_PLAY_PAUSE, {
        videoId: vid ?? undefined,
        isPlaying: nextState,
        both: bothLocked,
        userInfo,
        sessionId,
      });
    },
    [activeClipId, isPlaying, isTrainer, lockMode, selectedClips, sessionId, socket, userInfo]
  );

  const seek = useCallback(
    (progressSeconds: number, options?: { forceEmit?: boolean; videoId?: string }) => {
      const bothLocked = lockMode && selectedClips.length >= 2;
      const vid = options?.videoId ?? activeClipId;
      if (!vid && !bothLocked) return;
      const now = Date.now();
      setSeekHint({
        videoId: bothLocked ? "" : (vid ?? ""),
        progress: progressSeconds,
        receivedAt: now,
      });
      if (!isTrainer || !socket) return;
      if (!options?.forceEmit && now - lastSeekEmit.current < 200) return;
      lastSeekEmit.current = now;
      socket.emit(CLIP_EVENTS.ON_VIDEO_TIME, {
        videoId: vid ?? undefined,
        progress: progressSeconds,
        both: bothLocked,
        userInfo,
        sessionId,
      });
    },
    [activeClipId, isTrainer, lockMode, selectedClips.length, sessionId, socket, userInfo]
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

  const toggleLockMode = useCallback(
    (opts?: {
      lockPoint?: number;
      progresses?: [number, number];
      durations?: [number, number];
    }) => {
      const next = !lockMode;
      let nextLockPoint = lockPoint;
      if (next && opts) {
        if (typeof opts.lockPoint === "number") {
          nextLockPoint = opts.lockPoint;
        } else if (opts.progresses && opts.durations) {
          const [p0, p1] = opts.progresses;
          const [d0, d1] = opts.durations;
          nextLockPoint = d0 > d1 ? p0 : p1;
        }
        setLockPoint(nextLockPoint);
        setSeekHint({
          videoId: "",
          progress: nextLockPoint,
          receivedAt: Date.now(),
        });
      }
      lockModeRef.current = next;
      setLockMode(next);
      if (!next) {
        setClipFocusIndex(null);
        pendingPlayAfterLockRef.current = null;
      }
      if (!isTrainer || !socket) return;
      socket.emit(CLIP_EVENTS.TOGGLE_LOCK_MODE, {
        locked: next,
        isLockMode: next,
        lockPoint: nextLockPoint,
        userInfo,
        sessionId,
      });
    },
    [isTrainer, lockMode, lockPoint, socket, userInfo, sessionId]
  );

  const setClipFocus = useCallback(
    (index: 0 | 1 | null) => {
      const next = index;
      const on = next != null;
      setClipFocusIndex(next);
      setClipFullscreen(on);
      setLayoutMode(on ? "clipFullscreen" : "default");
      if (!isTrainer || !socket) return;
      socket.emit(
        CLIP_EVENTS.TOGGLE_FULL_SCREEN,
        buildFullscreenPayload({
          on,
          clipIndex: next,
          userInfo,
          sessionId,
          layoutMode: on ? "clipFullscreen" : "default",
        })
      );
    },
    [isTrainer, socket, userInfo, sessionId]
  );

  const toggleClipFullscreen = useCallback(
    (clipIndex?: 0 | 1) => {
      if (clipIndex === 0 || clipIndex === 1) {
        const next = clipFocusIndex === clipIndex ? null : clipIndex;
        setClipFocus(next);
        return;
      }
      const next = !clipFullscreen;
      setClipFullscreen(next);
      setClipFocusIndex(null);
      setLayoutMode(next ? "clipFullscreen" : "default");
      if (!isTrainer || !socket) return;
      socket.emit(
        CLIP_EVENTS.TOGGLE_FULL_SCREEN,
        buildFullscreenPayload({ on: next, userInfo, sessionId })
      );
    },
    [clipFocusIndex, clipFullscreen, isTrainer, setClipFocus, socket, userInfo, sessionId]
  );

  const setLayout = useCallback(
    (mode: ClipLayoutMode) => {
      setLayoutMode(mode);
      const fs = mode === "clipFullscreen";
      setClipFullscreen(fs);
      if (!isTrainer || !socket) return;
      socket.emit(
        CLIP_EVENTS.TOGGLE_FULL_SCREEN,
        buildFullscreenPayload({
          on: fs,
          layoutMode: mode,
          userInfo,
          sessionId,
        })
      );
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
    zoomPanByVideoId,
    bumpZoom,
    hiddenVideos,
    hideLocalCamera,
    seekHint,
    lockMode,
    lockPoint,
    layoutMode,
    clipFullscreen,
    clipFocusIndex,
    setClipFocus,
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
