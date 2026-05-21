/**
 * ClipPlayer — large-screen video player for the active lesson clip. Mirrors
 * `nq-frontend-main/app/components/portrait-calling/clip-mode.jsx` clip pane.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

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
  /** Trainer may pinch-to-zoom; second arg false = local preview only until gesture ends. */
  pinchEnabled?: boolean;
  onPinchZoom?: (zoom: number, emitSocket?: boolean) => void;
  onProgressSeconds?: (seconds: number) => void;
  onDurationSeconds?: (seconds: number) => void;
  onEnded?: () => void;
};

const CLIP_BG = "#ffffff";

export function ClipPlayer({
  uri,
  isPlaying,
  seekTargetMs,
  zoom = 1,
  pan,
  pinchEnabled = false,
  onPinchZoom,
  onProgressSeconds,
  onDurationSeconds,
  onEnded,
}: Props) {
  const videoRef = useRef<Video>(null);
  const pinchBaseZoomRef = useRef(zoom);
  const pinchingRef = useRef(false);
  const [localZoom, setLocalZoom] = useState(zoom);

  useEffect(() => {
    if (pinchingRef.current) return;
    setLocalZoom(zoom);
    pinchBaseZoomRef.current = zoom;
  }, [zoom]);

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

  const pinchGesture = useMemo(() => {
    if (!pinchEnabled || !onPinchZoom) return null;
    return Gesture.Pinch()
      .enabled(pinchEnabled)
      .onBegin(() => {
        pinchingRef.current = true;
        pinchBaseZoomRef.current = zoom;
        setLocalZoom(zoom);
      })
      .onUpdate((e: { scale: number }) => {
        const next = Math.max(1, Math.min(5, pinchBaseZoomRef.current * e.scale));
        setLocalZoom(next);
      })
      .onEnd((e: { scale: number }) => {
        const next = Math.max(1, Math.min(5, pinchBaseZoomRef.current * e.scale));
        pinchBaseZoomRef.current = next;
        setLocalZoom(next);
        pinchingRef.current = false;
        onPinchZoom(next, true);
      })
      .onFinalize(() => {
        pinchingRef.current = false;
      });
  }, [pinchEnabled, onPinchZoom, zoom]);

  const content = (
    <View style={styles.wrap}>
      <View
        style={[
          styles.transformLayer,
          {
            transform: [
              { translateX: typeof pan?.x === "number" ? pan.x : 0 },
              { translateY: typeof pan?.y === "number" ? pan.y : 0 },
              { scale: Number.isFinite(localZoom) ? localZoom : 1 },
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
            if (status.didJustFinish) onEnded?.();
            if (typeof status.durationMillis === "number" && status.durationMillis > 0) {
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
  );

  if (pinchGesture) {
    return <GestureDetector gesture={pinchGesture}>{content}</GestureDetector>;
  }
  return content;
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
  player: {
    flex: 1,
    backgroundColor: CLIP_BG,
  },
});
