/**
 * ClipPlayer — lesson clip with trainer pinch-zoom + pan (synced to trainee).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { clampPanForFrame, type PanPoint } from "../clipZoomPanUtils";
import { getObjectFitContainRect } from "../annotationCoords";

export type ClipPlayerHandle = {
  play: () => Promise<void> | void;
  pause: () => Promise<void> | void;
  seekTo: (seconds: number) => Promise<void> | void;
};

export type ZoomPanEmitMode = false | "throttle" | "immediate";

type Props = {
  uri: string;
  isPlaying: boolean;
  seekTargetMs?: number | null;
  /** Changes whenever a remote/local seek is requested — forces re-seek even at same ms. */
  seekNonce?: number | null;
  zoom?: number;
  pan?: PanPoint;
  /** Trainer can pinch-zoom and drag within the clip frame. */
  zoomGesturesEnabled?: boolean;
  onZoomPanChange?: (zoom: number, pan: PanPoint, emit?: ZoomPanEmitMode) => void;
  /** Fired when pinch/pan ends — flushes throttled socket sync. */
  onZoomPanEnd?: () => void;
  onProgressSeconds?: (seconds: number) => void;
  onDurationSeconds?: (seconds: number) => void;
  onEnded?: () => void;
  onReady?: () => void;
  onFrameLayout?: (width: number, height: number) => void;
  /** Intrinsic video dimensions (for annotation UV mapping). */
  onNaturalSize?: (width: number, height: number) => void;
  /** Visible contain-rect inside this player frame (for annotation UV mapping). */
  onAnnotationVideoRect?: (rect: { x: number; y: number; width: number; height: number }) => void;
};

const CLIP_BG = "#ffffff";
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

function clampZoom(z: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

export function ClipPlayer({
  uri,
  isPlaying,
  seekTargetMs,
  seekNonce,
  zoom = 1,
  pan,
  zoomGesturesEnabled = false,
  onZoomPanChange,
  onZoomPanEnd,
  onProgressSeconds,
  onDurationSeconds,
  onEnded,
  onReady,
  onFrameLayout,
  onNaturalSize,
  onAnnotationVideoRect,
}: Props) {
  const videoRef = React.useRef<Video>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const loadedRef = useRef(false);
  const readyNotifiedRef = useRef(false);
  const pendingPlayRef = useRef(isPlaying);
  const pendingSeekMsRef = useRef<number | null>(null);
  const frameSize = useRef({ w: 0, h: 0 });
  const gesturingRef = useRef(false);
  const pinchStartZoom = useRef(1);
  const panAtGrant = useRef<PanPoint>({ x: 0, y: 0 });
  const liveZoom = useRef(1);
  const livePan = useRef<PanPoint>({ x: 0, y: 0 });
  const naturalSizeRef = useRef<{ width: number; height: number } | null>(null);

  const reportAnnotationRect = useCallback(() => {
    if (!onAnnotationVideoRect) return;
    const { w, h } = frameSize.current;
    const ns = naturalSizeRef.current;
    if (w <= 0 || h <= 0 || !ns || ns.width <= 0 || ns.height <= 0) return;
    const base = getObjectFitContainRect(w, h, ns.width, ns.height);
    if (!base) return;
    const z = liveZoom.current;
    const pan = livePan.current;
    if (z <= 1.001) {
      onAnnotationVideoRect(base);
      return;
    }
    const cx = base.x + base.width / 2;
    const cy = base.y + base.height / 2;
    onAnnotationVideoRect({
      x: cx - (base.width * z) / 2 + pan.x,
      y: cy - (base.height * z) / 2 + pan.y,
      width: base.width * z,
      height: base.height * z,
    });
  }, [onAnnotationVideoRect]);

  const propZoom = clampZoom(Number.isFinite(zoom) ? zoom : 1);
  const propPanX = typeof pan?.x === "number" ? pan.x : 0;
  const propPanY = typeof pan?.y === "number" ? pan.y : 0;

  const [displayZoom, setDisplayZoom] = useState(propZoom);
  const [displayPan, setDisplayPan] = useState<PanPoint>({ x: propPanX, y: propPanY });

  useEffect(() => {
    liveZoom.current = propZoom;
    livePan.current = { x: propPanX, y: propPanY };
    if (!gesturingRef.current) {
      setDisplayZoom(propZoom);
      setDisplayPan({ x: propPanX, y: propPanY });
    }
    reportAnnotationRect();
  }, [propZoom, propPanX, propPanY, reportAnnotationRect]);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    setInitialLoading(true);
    setPlaybackError(false);
    loadedRef.current = false;
    readyNotifiedRef.current = false;
    pendingPlayRef.current = isPlayingRef.current;
    pendingSeekMsRef.current = seekTargetMs ?? null;
  }, [uri, retryKey]);

  const applyPlayState = useCallback(async (playing: boolean) => {
    const player = videoRef.current;
    if (!player) return;
    try {
      if (playing) await player.playAsync();
      else await player.pauseAsync();
    } catch {
      /* retry when loaded */
    }
  }, []);

  const applySeek = useCallback(async (ms: number) => {
    const player = videoRef.current;
    if (!player) return;
    try {
      await player.setPositionAsync(Math.max(0, ms));
    } catch {
      /* retry when loaded */
    }
  }, []);

  const flushPending = useCallback(() => {
    if (!loadedRef.current) return;
    if (pendingSeekMsRef.current != null) {
      const ms = pendingSeekMsRef.current;
      pendingSeekMsRef.current = null;
      void applySeek(ms);
    }
    void applyPlayState(pendingPlayRef.current);
  }, [applyPlayState, applySeek]);

  useEffect(() => {
    pendingPlayRef.current = isPlaying;
    if (!loadedRef.current) return;
    void applyPlayState(isPlaying);
  }, [applyPlayState, isPlaying]);

  useEffect(() => {
    if (seekTargetMs == null) return;
    if (!loadedRef.current) {
      pendingSeekMsRef.current = seekTargetMs;
      return;
    }
    pendingSeekMsRef.current = null;
    void applySeek(seekTargetMs);
  }, [applySeek, seekTargetMs, seekNonce]);

  useEffect(() => {
    if (!loadedRef.current) return;
    flushPending();
  }, [flushPending, uri]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      frameSize.current = { w: width, h: height };
      if (width > 0 && height > 0) {
        onFrameLayout?.(width, height);
        reportAnnotationRect();
      }
    },
    [onFrameLayout, reportAnnotationRect]
  );

  const clampPanForFrameLocal = useCallback(
    (next: PanPoint, zoomLevel: number) => {
      const { w, h } = frameSize.current;
      if (w <= 0 || h <= 0) return next;
      return clampPanForFrame(next, w, h, zoomLevel);
    },
    []
  );

  const applyZoomPan = useCallback(
    (nextZoom: number, nextPan: PanPoint, emit: ZoomPanEmitMode = "throttle") => {
      const z = clampZoom(nextZoom);
      let p = clampPanForFrameLocal(nextPan, z);
      if (z <= 1) {
        p = { x: 0, y: 0 };
      }
      liveZoom.current = z;
      livePan.current = p;
      setDisplayZoom(z);
      setDisplayPan(p);
      onZoomPanChange?.(z, p, emit);
      reportAnnotationRect();
    },
    [clampPanForFrameLocal, onZoomPanChange, reportAnnotationRect]
  );

  const endGesture = useCallback(() => {
    gesturingRef.current = false;
    onZoomPanEnd?.();
  }, [onZoomPanEnd]);

  const pinchBegin = useCallback(() => {
    gesturingRef.current = true;
    pinchStartZoom.current = liveZoom.current;
  }, []);

  const panBegin = useCallback(() => {
    gesturingRef.current = true;
    panAtGrant.current = { ...livePan.current };
  }, []);

  const onPinchUpdate = useCallback(
    (scale: number) => {
      const nextZoom = clampZoom(pinchStartZoom.current * scale);
      const nextPan = clampPanForFrameLocal(livePan.current, nextZoom);
      applyZoomPan(nextZoom, nextPan, "throttle");
    },
    [applyZoomPan, clampPanForFrameLocal]
  );

  const onPanUpdate = useCallback(
    (translationX: number, translationY: number) => {
      const zoomNow = liveZoom.current || 1;
      if (zoomNow <= 1.001) return;
      const next = {
        x: panAtGrant.current.x + translationX / zoomNow,
        y: panAtGrant.current.y + translationY / zoomNow,
      };
      applyZoomPan(zoomNow, next, "throttle");
    },
    [applyZoomPan]
  );

  const pinchGesture = useMemo(() => {
    if (!zoomGesturesEnabled || !onZoomPanChange) {
      return Gesture.Pinch().enabled(false);
    }
    return Gesture.Pinch()
      .onBegin(() => {
        runOnJS(pinchBegin)();
      })
      .onUpdate((e) => {
        runOnJS(onPinchUpdate)(e.scale);
      })
      .onFinalize(() => {
        runOnJS(endGesture)();
      });
  }, [
    endGesture,
    onPinchUpdate,
    onZoomPanChange,
    pinchBegin,
    zoomGesturesEnabled,
  ]);

  const panGesture = useMemo(() => {
    if (!zoomGesturesEnabled || !onZoomPanChange) {
      return Gesture.Pan().enabled(false);
    }
    return Gesture.Pan()
      .maxPointers(1)
      .minPointers(1)
      .activeOffsetX([-4, 4])
      .activeOffsetY([-4, 4])
      .onBegin(() => {
        runOnJS(panBegin)();
      })
      .onUpdate((e) => {
        runOnJS(onPanUpdate)(e.translationX, e.translationY);
      })
      .onFinalize(() => {
        runOnJS(endGesture)();
      });
  }, [endGesture, onPanUpdate, onZoomPanChange, panBegin, zoomGesturesEnabled]);

  const clipGestures = useMemo(
    () => Gesture.Simultaneous(pinchGesture, panGesture),
    [pinchGesture, panGesture]
  );

  const handleRetry = useCallback(() => {
    setPlaybackError(false);
    setInitialLoading(true);
    setRetryKey((k) => k + 1);
  }, []);

  if (playbackError) {
    return (
      <View style={styles.wrap}>
        <View style={styles.errorOverlay}>
          <Ionicons name="alert-circle-outline" size={28} color="#64748b" />
          <Text style={styles.errorTitle}>Clip unavailable</Text>
          <Text style={styles.errorBody}>This clip could not be loaded. Check your connection and try again.</Text>
          <Pressable onPress={handleRetry} style={styles.retryBtn} accessibilityRole="button">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <GestureDetector gesture={clipGestures}>
      <View style={styles.wrap} onLayout={onLayout}>
        <View
          style={[
            styles.transformLayer,
            { transform: [{ scale: displayZoom }] },
          ]}
        >
          <View
            style={[
              styles.panLayer,
              {
                transform: [
                  { translateX: displayPan.x },
                  { translateY: displayPan.y },
                ],
              },
            ]}
          >
            <Video
              key={`${uri}-${retryKey}`}
              ref={videoRef}
              source={{ uri }}
              style={styles.player}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={isPlaying}
              isLooping={false}
              useNativeControls={false}
              onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
                if (!status.isLoaded) return;
                if (!loadedRef.current) {
                  loadedRef.current = true;
                  if (!readyNotifiedRef.current) {
                    readyNotifiedRef.current = true;
                    onReady?.();
                  }
                  setInitialLoading(false);
                  flushPending();
                } else if (
                  initialLoading &&
                  (status.durationMillis != null ||
                    (status.positionMillis ?? 0) > 0 ||
                    status.isPlaying ||
                    pendingPlayRef.current)
                ) {
                  setInitialLoading(false);
                  flushPending();
                }
                if (status.didJustFinish) onEnded?.();
                if (
                  typeof status.durationMillis === "number" &&
                  status.durationMillis > 0
                ) {
                  onDurationSeconds?.(status.durationMillis / 1000);
                }
                const ns = (status as { naturalSize?: { width: number; height: number } })
                  .naturalSize;
                if (ns && ns.width > 0 && ns.height > 0) {
                  naturalSizeRef.current = { width: ns.width, height: ns.height };
                  onNaturalSize?.(ns.width, ns.height);
                  reportAnnotationRect();
                }
                if (onProgressSeconds && typeof status.positionMillis === "number") {
                  onProgressSeconds(status.positionMillis / 1000);
                }
              }}
              onError={(e) => {
                setInitialLoading(false);
                setPlaybackError(true);
                if (__DEV__) {
                  console.warn("[ClipPlayer] playback failed", { uri, error: e });
                }
              }}
            />
          </View>
        </View>
        {initialLoading ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color="#64748b" />
            <Text style={styles.loadingText}>Loading video…</Text>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: CLIP_BG,
    overflow: "hidden",
  },
  transformLayer: {
    flex: 1,
    backgroundColor: CLIP_BG,
  },
  panLayer: {
    flex: 1,
  },
  player: {
    flex: 1,
    backgroundColor: CLIP_BG,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248,250,252,0.94)",
    gap: 8,
  },
  loadingText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  errorOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 8,
    backgroundColor: "#f8fafc",
  },
  errorTitle: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  errorBody: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#1e3a5f",
  },
  retryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
