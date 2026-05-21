/**
 * ClipPlayer — large-screen video player for the active lesson clip.
 */

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
} from "react-native";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";

export type ClipPlayerHandle = {
  play: () => Promise<void> | void;
  pause: () => Promise<void> | void;
  seekTo: (seconds: number) => Promise<void> | void;
};

type Props = {
  uri: string;
  isPlaying: boolean;
  seekTargetMs?: number | null;
  zoom?: number;
  pan?: { x: number; y: number };
  panEnabled?: boolean;
  onPanChange?: (pan: { x: number; y: number }, emitSocket?: boolean) => void;
  onProgressSeconds?: (seconds: number) => void;
  onDurationSeconds?: (seconds: number) => void;
  onEnded?: () => void;
};

const CLIP_BG = "#ffffff";
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

function clampZoom(z: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

function clampPan(
  pan: { x: number; y: number },
  frameW: number,
  frameH: number,
  zoom: number
): { x: number; y: number } {
  if (frameW <= 0 || frameH <= 0 || zoom <= 1) {
    return { x: 0, y: 0 };
  }
  const maxX = (frameW * (zoom - 1)) / 2;
  const maxY = (frameH * (zoom - 1)) / 2;
  return {
    x: Math.max(-maxX, Math.min(maxX, pan.x)),
    y: Math.max(-maxY, Math.min(maxY, pan.y)),
  };
}

export function ClipPlayer({
  uri,
  isPlaying,
  seekTargetMs,
  zoom = 1,
  pan,
  panEnabled = false,
  onPanChange,
  onProgressSeconds,
  onDurationSeconds,
  onEnded,
}: Props) {
  const videoRef = React.useRef<Video>(null);
  const frameSize = useRef({ w: 0, h: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const panAtGrant = useRef({ x: 0, y: 0 });
  /** Refs so the PanResponder closure can read latest pan/zoom without
   *  re-memoizing the responder on every emit (which would create churn). */
  const currentPanRef = useRef({ x: 0, y: 0 });
  const currentZoomRef = useRef(1);

  const z = clampZoom(Number.isFinite(zoom) ? zoom : 1);
  const panX = typeof pan?.x === "number" ? pan.x : 0;
  const panY = typeof pan?.y === "number" ? pan.y : 0;

  useEffect(() => {
    currentPanRef.current = { x: panX, y: panY };
  }, [panX, panY]);

  useEffect(() => {
    currentZoomRef.current = z;
  }, [z]);

  useEffect(() => {
    const player = videoRef.current;
    if (!player) return;
    if (isPlaying) player.playAsync().catch(() => undefined);
    else player.pauseAsync().catch(() => undefined);
  }, [isPlaying]);

  useEffect(() => {
    if (seekTargetMs == null) return;
    videoRef.current
      ?.setPositionAsync(Math.max(0, seekTargetMs))
      .catch(() => undefined);
  }, [seekTargetMs]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    frameSize.current = { w: width, h: height };
  }, []);

  const emitPan = useCallback(
    (next: { x: number; y: number }, emitSocket: boolean) => {
      const clamped = clampPan(
        next,
        frameSize.current.w,
        frameSize.current.h,
        currentZoomRef.current
      );
      onPanChange?.(clamped, emitSocket);
    },
    [onPanChange]
  );

  const panResponder = useMemo(() => {
    if (!panEnabled || !onPanChange) return null;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => currentZoomRef.current > 1,
      onMoveShouldSetPanResponder: (_, g) =>
        currentZoomRef.current > 1 &&
        (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4),
      onPanResponderGrant: () => {
        panAtGrant.current = { ...currentPanRef.current };
        panStart.current = { ...currentPanRef.current };
      },
      onPanResponderMove: (_, g) => {
        const zoomNow = currentZoomRef.current || 1;
        const next = {
          x: panAtGrant.current.x + g.dx / zoomNow,
          y: panAtGrant.current.y + g.dy / zoomNow,
        };
        panStart.current = next;
        emitPan(next, true);
      },
      onPanResponderRelease: () => {
        emitPan(panStart.current, true);
      },
      onPanResponderTerminate: () => {
        emitPan(panStart.current, true);
      },
    });
  }, [emitPan, onPanChange, panEnabled]);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <View
        style={[
          styles.transformLayer,
          { transform: [{ scale: z }] },
        ]}
      >
        <View
          style={[
            styles.panLayer,
            { transform: [{ translateX: panX }, { translateY: panY }] },
          ]}
          {...(panResponder ? panResponder.panHandlers : {})}
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
              if (__DEV__) console.warn("[ClipPlayer] playback failed", { uri, error: e });
            }}
          />
        </View>
      </View>
    </View>
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
