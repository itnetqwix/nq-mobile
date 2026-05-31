/**
 * ClipPlayer — lesson clip with trainer pinch-zoom + pan (synced to trainee).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { MediaLoadingOverlay } from "../../../components/media/MediaLoadingOverlay";
import { clampPanForFrame, type PanPoint } from "../clipZoomPanUtils";

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
}: Props) {
  const videoRef = React.useRef<Video>(null);
  const [initialLoading, setInitialLoading] = useState(true);
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
  }, [propZoom, propPanX, propPanY]);

  useEffect(() => {
    setInitialLoading(true);
    loadedRef.current = false;
    readyNotifiedRef.current = false;
    pendingPlayRef.current = false;
    pendingSeekMsRef.current = null;
  }, [uri]);

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
  }, [applySeek, seekTargetMs]);

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
      }
    },
    [onFrameLayout]
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
    },
    [clampPanForFrameLocal, onZoomPanChange]
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

  const pinchGesture = useMemo(() => {
    if (!zoomGesturesEnabled || !onZoomPanChange) {
      return Gesture.Pinch().enabled(false);
    }
    return Gesture.Pinch()
      .onBegin(() => {
        runOnJS(pinchBegin)();
      })
      .onUpdate((e) => {
        const nextZoom = clampZoom(pinchStartZoom.current * e.scale);
        const nextPan = clampPanForFrameLocal(livePan.current, nextZoom);
        runOnJS(applyZoomPan)(nextZoom, nextPan, "throttle");
      })
      .onFinalize(() => {
        runOnJS(endGesture)();
      });
  }, [
    applyZoomPan,
    endGesture,
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
        const zoomNow = liveZoom.current || 1;
        const next = {
          x: panAtGrant.current.x + e.translationX / zoomNow,
          y: panAtGrant.current.y + e.translationY / zoomNow,
        };
        runOnJS(applyZoomPan)(zoomNow, next, "throttle");
      })
      .onFinalize(() => {
        runOnJS(endGesture)();
      });
  }, [applyZoomPan, endGesture, onZoomPanChange, panBegin, zoomGesturesEnabled]);

  const clipGestures = useMemo(
    () => Gesture.Simultaneous(pinchGesture, panGesture),
    [pinchGesture, panGesture]
  );

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
                  flushPending();
                }
                if (
                  initialLoading &&
                  (status.durationMillis != null ||
                    (status.positionMillis ?? 0) > 0 ||
                    status.isPlaying)
                ) {
                  setInitialLoading(false);
                }
                if (status.didJustFinish) onEnded?.();
                if (
                  typeof status.durationMillis === "number" &&
                  status.durationMillis > 0
                ) {
                  onDurationSeconds?.(status.durationMillis / 1000);
                }
                if (onProgressSeconds && typeof status.positionMillis === "number") {
                  onProgressSeconds(status.positionMillis / 1000);
                }
              }}
              onError={(e) => {
                if (__DEV__) {
                  console.warn("[ClipPlayer] playback failed", { uri, error: e });
                }
              }}
            />
          </View>
        </View>
        {initialLoading ? (
          <MediaLoadingOverlay message="Loading clip" size="compact" />
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
});
