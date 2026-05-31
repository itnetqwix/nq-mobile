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
import {
  clampPanForFrame,
  panFromNormalized,
  panToNormalized,
  type PanPoint,
} from "./clipZoomPanUtils";
import {
  LESSON_NETWORK_TIER_CONFIG,
  type LessonNetworkTier,
} from "./lessonNetworkTier";

type SeekHint = {
  videoId: string;
  progress: number;
  receivedAt: number;
} | null;

type ZoomPan = {
  zoom: number;
  pan: PanPoint;
  panNx?: number;
  panNy?: number;
};

type ZoomPanEmitMode = false | "throttle" | "immediate";

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
  /** Adaptive network tier — throttles progress emits on fair/slow links. */
  networkTier?: LessonNetworkTier;
  /** Trainer: trainee broadcast new clips via ON_VIDEO_SELECT. */
  onPeerClipsShared?: () => void;
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
  setIsPlaying: (v: boolean) => void,
  setPlayingByClipId: (v: Record<string, boolean>) => void
) {
  setSelectedClips(clips);
  if (clips.length === 0) {
    setActiveClipId(null);
    setActiveClipUrl(null);
    setIsPlaying(false);
    setPlayingByClipId({});
    return;
  }
  const primary = primaryClipFromList(clips);
  const { id, url } = resolveClipPlayback(primary);
  setActiveClipId(id);
  setActiveClipUrl(url);
  setIsPlaying(false);
  const playing: Record<string, boolean> = {};
  for (const c of clips) {
    const cid = clipIdOf(c);
    if (cid) playing[cid] = false;
  }
  setPlayingByClipId(playing);
}

export function useClipSync({
  socket,
  fromUserId,
  toUserId,
  sessionId,
  isTrainer = false,
  networkTier = "normal",
  onPeerClipsShared,
}: Args) {
  const networkTierRef = useRef(networkTier);
  networkTierRef.current = networkTier;
  const [selectedClips, setSelectedClips] = useState<ClipRecord[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [activeClipUrl, setActiveClipUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingByClipId, setPlayingByClipId] = useState<Record<string, boolean>>({});
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
  const lastPeriodicProgressEmit = useRef(0);
  const lastProgressByClipId = useRef<Record<string, number>>({});
  const clipFrameSizesRef = useRef<Record<string, { w: number; h: number }>>({});
  const pendingZoomPanEmitRef = useRef<
    Record<string, { zoom: number; pan: PanPoint }>
  >({});
  const zoomPanEmitTimerRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const bookingPreloadedRef = useRef(false);
  const lockModeRef = useRef(false);
  const pendingPlayAfterLockRef = useRef<boolean | null>(null);

  const userInfo: ClipUserInfo = { from_user: fromUserId, to_user: toUserId };

  const matchesSession = useCallback(
    (payload: { sessionId?: string }) => {
      if (!sessionId) return true;
      const sid = payload?.sessionId;
      return !sid || String(sid) === String(sessionId);
    },
    [sessionId]
  );

  // Hard reset clip state when call/session pair changes, so a previous call's
  // selected clips never leak into a fresh meeting with no booking clips.
  useEffect(() => {
    bookingPreloadedRef.current = false;
    lockModeRef.current = false;
    pendingPlayAfterLockRef.current = null;
    lastSeekEmit.current = 0;
    setSelectedClips([]);
    setActiveClipId(null);
    setActiveClipUrl(null);
    setIsPlaying(false);
    setPlayingByClipId({});
    setHiddenVideos(EMPTY_HIDDEN);
    setSeekHint(null);
    setLockMode(false);
    setLockPoint(0);
    setLayoutMode("default");
    setClipFullscreen(false);
    setClipFocusIndex(null);
    setZoomPanByVideoId({});
    clipFrameSizesRef.current = {};
    pendingZoomPanEmitRef.current = {};
    Object.values(zoomPanEmitTimerRef.current).forEach(clearTimeout);
    zoomPanEmitTimerRef.current = {};
  }, [sessionId, fromUserId, toUserId]);

  useEffect(() => {
    if (!socket) return;

    const onSelect = (payload: any) => {
      if (!matchesSession(payload)) return;
      const type = payload?.type;

      if (type === "clips") {
        const clips = normalizeClipsFromSocket(clipsFromSelectPayload(payload)).slice(0, 2);
        const fromPeer = String(payload?.userInfo?.from_user ?? "");
        if (
          isTrainer &&
          fromPeer &&
          fromPeer !== String(fromUserId) &&
          clips.length > 0
        ) {
          onPeerClipsShared?.();
        }
        applyClipsToState(
          clips,
          setSelectedClips,
          setActiveClipId,
          setActiveClipUrl,
          setIsPlaying,
          setPlayingByClipId
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
        setPlayingByClipId({ [id]: false });
        return;
      }

      setSelectedClips([]);
      setActiveClipId(null);
      setActiveClipUrl(null);
      setIsPlaying(false);
      setPlayingByClipId({});
    };

    const onPlayPause = (payload: any) => {
      if (!matchesSession(payload)) return;
      const both = !!(payload?.both || lockModeRef.current);
      const nextPlaying = !!payload?.isPlaying;
      if (both) {
        if (lockModeRef.current && pendingPlayAfterLockRef.current == null) {
          pendingPlayAfterLockRef.current = nextPlaying;
        }
        setIsPlaying(nextPlaying);
        return;
      }
      const vid = payload?.videoId != null ? String(payload.videoId) : null;
      if (!vid) return;
      setPlayingByClipId((prev) => ({ ...prev, [vid]: nextPlaying }));
    };

    const onTime = (payload: any) => {
      if (!matchesSession(payload)) return;
      if (typeof payload?.progress !== "number") return;
      const both = !!(payload?.both || lockModeRef.current);
      if (both) {
        lastProgressByClipId.current.__both = payload.progress;
        setSeekHint({
          videoId: "",
          progress: payload.progress,
          receivedAt: Date.now(),
        });
        return;
      }
      const vid = payload?.videoId != null ? String(payload.videoId) : null;
      if (!vid) return;
      lastProgressByClipId.current[vid] = payload.progress;
      setSeekHint({
        videoId: vid,
        progress: payload.progress,
        receivedAt: Date.now(),
      });
    };

    const onHide = (payload: any) => {
      if (!matchesSession(payload)) return;
      const videoType = payload?.videoType;
      if (!videoType) return;
      setHiddenVideos((prev) => applyVideoTypeHide(prev, String(videoType), true));
    };

    const onShow = (payload: any) => {
      if (!matchesSession(payload)) return;
      const videoType = payload?.videoType;
      if (!videoType) return;
      setHiddenVideos((prev) => applyVideoTypeHide(prev, String(videoType), false));
    };

    const onLockMode = (payload: any) => {
      if (!matchesSession(payload)) return;
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
      if (
        !shouldApplyRemoteSocketEvent(payload, {
          sessionId,
          myUserId: fromUserId,
          isTrainer,
        })
      ) {
        return;
      }
      const videoId = String(payload?.videoId ?? payload?.clipId ?? "");
      if (!videoId) return;
      const zoomRaw = typeof payload?.zoom === "number" ? payload.zoom : NaN;
      const nextZoom = Number.isFinite(zoomRaw)
        ? Math.max(1, Math.min(5, zoomRaw))
        : 1;
      const frame = clipFrameSizesRef.current[videoId];
      let nextPan: PanPoint = { x: 0, y: 0 };
      if (
        frame &&
        typeof payload?.panNx === "number" &&
        typeof payload?.panNy === "number"
      ) {
        nextPan = panFromNormalized(
          payload.panNx,
          payload.panNy,
          frame.w,
          frame.h,
          nextZoom
        );
      } else {
        const pan = payload?.pan;
        if (pan && typeof pan.x === "number" && typeof pan.y === "number") {
          nextPan = frame
            ? clampPanForFrame({ x: pan.x, y: pan.y }, frame.w, frame.h, nextZoom)
            : { x: pan.x, y: pan.y };
        }
      }
      const panNorm =
        frame && nextZoom > 1
          ? panToNormalized(nextPan, frame.w, frame.h, nextZoom)
          : { panNx: 0, panNy: 0 };
      setZoomPanByVideoId((prev) => {
        const cur = prev[videoId] ?? { zoom: 1, pan: { x: 0, y: 0 } };
        return {
          ...prev,
          [videoId]: {
            zoom: Number.isFinite(zoomRaw) ? nextZoom : cur.zoom,
            pan: nextPan,
            panNx: panNorm.panNx,
            panNy: panNorm.panNy,
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
  }, [socket, sessionId, fromUserId, isTrainer, matchesSession, onPeerClipsShared]);

  const isClipPlaying = useCallback(
    (clipId: string | null | undefined) => {
      if (!clipId) return false;
      if (lockMode && selectedClips.length >= 2) return isPlaying;
      return !!playingByClipId[String(clipId)];
    },
    [isPlaying, lockMode, playingByClipId, selectedClips.length]
  );

  const registerClipFrameSize = useCallback((videoId: string, w: number, h: number) => {
    if (!videoId || w <= 0 || h <= 0) return;
    const id = String(videoId);
    clipFrameSizesRef.current[id] = { w, h };
    setZoomPanByVideoId((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      if (typeof cur.panNx === "number" && typeof cur.panNy === "number") {
        const pan = panFromNormalized(cur.panNx, cur.panNy, w, h, cur.zoom);
        if (pan.x === cur.pan.x && pan.y === cur.pan.y) return prev;
        return { ...prev, [id]: { ...cur, pan } };
      }
      if (cur.zoom <= 1) return prev;
      const pan = clampPanForFrame(cur.pan, w, h, cur.zoom);
      if (pan.x === cur.pan.x && pan.y === cur.pan.y) return prev;
      return { ...prev, [id]: { ...cur, pan } };
    });
  }, []);

  const emitZoomPan = useCallback(
    (videoId: string, zoom: number, pan: PanPoint) => {
      if (!socket || !sessionId || !videoId) return;
      const frame = clipFrameSizesRef.current[String(videoId)];
      const { panNx, panNy } = frame
        ? panToNormalized(pan, frame.w, frame.h, zoom)
        : { panNx: 0, panNy: 0 };
      socket.emit(CLIP_EVENTS.ON_VIDEO_ZOOM_PAN, {
        videoId,
        zoom,
        pan,
        panNx,
        panNy,
        userInfo,
        sessionId,
      });
    },
    [socket, sessionId, userInfo]
  );

  const flushZoomPanEmit = useCallback(
    (videoId: string) => {
      const id = String(videoId);
      if (zoomPanEmitTimerRef.current[id]) {
        clearTimeout(zoomPanEmitTimerRef.current[id]);
        delete zoomPanEmitTimerRef.current[id];
      }
      const pending = pendingZoomPanEmitRef.current[id];
      if (pending) {
        emitZoomPan(id, pending.zoom, pending.pan);
        delete pendingZoomPanEmitRef.current[id];
      }
    },
    [emitZoomPan]
  );

  const queueZoomPanEmit = useCallback(
    (videoId: string, zoom: number, pan: PanPoint) => {
      const id = String(videoId);
      pendingZoomPanEmitRef.current[id] = { zoom, pan };
      if (zoomPanEmitTimerRef.current[id]) return;
      zoomPanEmitTimerRef.current[id] = setTimeout(() => {
        const pending = pendingZoomPanEmitRef.current[id];
        if (pending) {
          emitZoomPan(id, pending.zoom, pending.pan);
          delete pendingZoomPanEmitRef.current[id];
        }
        delete zoomPanEmitTimerRef.current[id];
      }, 36);
    },
    [emitZoomPan]
  );

  const writeZoomPanState = useCallback(
    (videoId: string, zoom: number, pan: PanPoint) => {
      const id = String(videoId);
      const nextZoom = Math.max(1, Math.min(5, zoom));
      const frame = clipFrameSizesRef.current[id];
      let clamped = pan;
      if (nextZoom <= 1) {
        clamped = { x: 0, y: 0 };
      } else if (frame) {
        clamped = clampPanForFrame(pan, frame.w, frame.h, nextZoom);
      }
      const panNorm =
        frame && nextZoom > 1
          ? panToNormalized(clamped, frame.w, frame.h, nextZoom)
          : { panNx: 0, panNy: 0 };
      setZoomPanByVideoId((prev) => ({
        ...prev,
        [id]: {
          zoom: nextZoom,
          pan: clamped,
          panNx: panNorm.panNx,
          panNy: panNorm.panNy,
        },
      }));
      return { zoom: nextZoom, pan: clamped };
    },
    []
  );

  const bumpZoom = useCallback(
    (videoId: string, delta: number) => {
      if (!videoId) return;
      const id = String(videoId);
      const cur = zoomPanByVideoId[id] ?? { zoom: 1, pan: { x: 0, y: 0 } };
      const nextZoom = Math.max(1, Math.min(5, cur.zoom + delta));
      const frame = clipFrameSizesRef.current[id];
      let nextPan = cur.pan;
      if (nextZoom <= 1) {
        nextPan = { x: 0, y: 0 };
      } else if (frame) {
        nextPan = clampPanForFrame(cur.pan, frame.w, frame.h, nextZoom);
      }
      const applied = writeZoomPanState(id, nextZoom, nextPan);
      if (isTrainer) {
        emitZoomPan(id, applied.zoom, applied.pan);
      }
    },
    [emitZoomPan, isTrainer, writeZoomPanState, zoomPanByVideoId]
  );

  const setZoomPan = useCallback(
    (
      videoId: string,
      zoom: number,
      pan: PanPoint,
      options?: { emitSocket?: ZoomPanEmitMode }
    ) => {
      if (!videoId) return;
      const id = String(videoId);
      const applied = writeZoomPanState(id, zoom, pan);
      if (!isTrainer || options?.emitSocket === false) return;
      if (options?.emitSocket === "immediate") {
        flushZoomPanEmit(id);
        emitZoomPan(id, applied.zoom, applied.pan);
        return;
      }
      queueZoomPanEmit(id, applied.zoom, applied.pan);
    },
    [emitZoomPan, flushZoomPanEmit, isTrainer, queueZoomPanEmit, writeZoomPanState]
  );

  const setActiveClip = useCallback((clipId: string, playbackUrl?: string | null) => {
    setActiveClipId(clipId);
    if (playbackUrl != null) setActiveClipUrl(playbackUrl);
  }, []);

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
        setIsPlaying,
        setPlayingByClipId
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
    (clips: ClipRecord[], options?: { force?: boolean }) => {
      if (bookingPreloadedRef.current && !options?.force) return;
      const playable = clips.filter((c) => resolveClipPlayback(c).url).slice(0, 2);
      if (playable.length === 0) return;
      bookingPreloadedRef.current = true;
      emitSelectClips(playable, { emitSocket: true });
    },
    [emitSelectClips]
  );

  /** Trainee mid-lesson share — persist is handled by the screen; this broadcasts. */
  const broadcastClipsMidLesson = useCallback(
    (clips: ClipRecord[]) => {
      bookingPreloadedRef.current = true;
      emitSelectClips(clips, { emitSocket: true });
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
      if (bothLocked) {
        const nextState = typeof next === "boolean" ? next : !isPlaying;
        setIsPlaying(nextState);
        if (!isTrainer || !socket) return;
        socket.emit(CLIP_EVENTS.ON_VIDEO_PLAY_PAUSE, {
          videoId: vid ?? undefined,
          isPlaying: nextState,
          both: true,
          userInfo,
          sessionId,
        });
        return;
      }
      if (!vid) return;
      const current = playingByClipId[vid] ?? false;
      const nextState = typeof next === "boolean" ? next : !current;
      setPlayingByClipId((prev) => ({ ...prev, [vid]: nextState }));
      setActiveClipId(vid);
      if (!isTrainer || !socket) return;
      socket.emit(CLIP_EVENTS.ON_VIDEO_PLAY_PAUSE, {
        videoId: vid,
        isPlaying: nextState,
        both: false,
        userInfo,
        sessionId,
      });
    },
    [
      activeClipId,
      isPlaying,
      isTrainer,
      lockMode,
      playingByClipId,
      selectedClips,
      sessionId,
      socket,
      userInfo,
    ]
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

  /** Re-broadcast clip UI state after trainer reconnects so trainee stays in sync. */
  const replayClipSocketState = useCallback(() => {
    if (!socket?.connected || !sessionId || !isTrainer) return;
    if (selectedClips.length > 0) {
      socket.emit(CLIP_EVENTS.ON_VIDEO_SELECT, {
        type: "clips",
        videos: selectedClips,
        userInfo,
        sessionId,
      });
    }
    Object.entries(zoomPanByVideoId).forEach(([videoId, zp]) => {
      emitZoomPan(videoId, zp.zoom, zp.pan);
    });
    if (lockMode) {
      socket.emit(CLIP_EVENTS.TOGGLE_LOCK_MODE, {
        locked: true,
        isLockMode: true,
        lockPoint,
        userInfo,
        sessionId,
      });
    }
    if (lockMode && selectedClips.length >= 2) {
      socket.emit(CLIP_EVENTS.ON_VIDEO_PLAY_PAUSE, {
        isPlaying,
        both: true,
        userInfo,
        sessionId,
      });
    } else {
      Object.entries(playingByClipId).forEach(([videoId, playing]) => {
        if (!playing) return;
        socket.emit(CLIP_EVENTS.ON_VIDEO_PLAY_PAUSE, {
          videoId,
          isPlaying: true,
          both: false,
          userInfo,
          sessionId,
        });
      });
    }
    if (clipFocusIndex === 0 || clipFocusIndex === 1) {
      socket.emit(
        CLIP_EVENTS.TOGGLE_FULL_SCREEN,
        buildFullscreenPayload({
          on: true,
          clipIndex: clipFocusIndex,
          userInfo,
          sessionId,
        })
      );
    }
    const bothProgress = lastProgressByClipId.current.__both;
    if (typeof bothProgress === "number" && lockMode) {
      socket.emit(CLIP_EVENTS.ON_VIDEO_TIME, {
        progress: bothProgress,
        both: true,
        userInfo,
        sessionId,
      });
    } else {
      Object.entries(lastProgressByClipId.current).forEach(([videoId, progress]) => {
        if (videoId.startsWith("__") || typeof progress !== "number") return;
        socket.emit(CLIP_EVENTS.ON_VIDEO_TIME, {
          videoId,
          progress,
          both: false,
          userInfo,
          sessionId,
        });
      });
    }
  }, [
    clipFocusIndex,
    emitZoomPan,
    isPlaying,
    isTrainer,
    lockMode,
    lockPoint,
    playingByClipId,
    selectedClips,
    sessionId,
    socket,
    userInfo,
    zoomPanByVideoId,
  ]);

  const hideLocalCamera =
    hiddenVideos.teacher && hiddenVideos.student
      ? true
      : hiddenVideos.teacher || hiddenVideos.student;

  /** Trainer: periodic playback position broadcast while clips play (drift correction). */
  const syncPlaybackProgress = useCallback(
    (videoId: string | null, progressSeconds: number) => {
      if (!isTrainer || !socket || !sessionId || !videoId) return;
      lastProgressByClipId.current[String(videoId)] = progressSeconds;
      if (!isPlaying) return;
      const now = Date.now();
      const minMs =
        LESSON_NETWORK_TIER_CONFIG[networkTierRef.current].clipProgressEmitMs;
      if (now - lastPeriodicProgressEmit.current < minMs) return;
      lastPeriodicProgressEmit.current = now;
      const bothLocked = lockMode && selectedClips.length >= 2;
      socket.emit(CLIP_EVENTS.ON_VIDEO_TIME, {
        videoId: bothLocked ? undefined : String(videoId),
        progress: progressSeconds,
        both: bothLocked,
        userInfo,
        sessionId,
      });
    },
    [isPlaying, isTrainer, lockMode, selectedClips.length, sessionId, socket, userInfo]
  );

  return {
    selectedClips,
    activeClipId,
    activeClipUrl,
    isPlaying,
    playingByClipId,
    isClipPlaying,
    zoomPanByVideoId,
    registerClipFrameSize,
    flushZoomPanEmit,
    bumpZoom,
    setZoomPan,
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
    setActiveClip,
    emitSelectClips,
    broadcastClipsMidLesson,
    preloadBookingClips,
    togglePlay,
    seek,
    setVideoHidden,
    hideLiveCamera,
    toggleLockMode,
    toggleClipFullscreen,
    setLayout,
    replayClipSocketState,
    syncPlaybackProgress,
  };
}
