/**
 * ClipPlayer — large-screen video player for the active lesson clip.
 */

import React, { useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

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
  pinchEnabled?: boolean;
  onPinchZoom?: (zoom: number, emitSocket?: boolean) => void;
  onProgressSeconds?: (seconds: number) => void;
  onDurationSeconds?: (seconds: number) => void;
  onEnded?: () => void;
};

const CLIP_BG = "#ffffff";
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

function clampZoom(z: number) {
  "worklet";
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

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
  const videoRef = React.useRef<Video>(null);
  const zoomShared = useSharedValue(zoom);
  const baseZoom = useSharedValue(zoom);
  const [pinching, setPinching] = React.useState(false);

  const commitZoom = useCallback(
    (next: number) => {
      setPinching(false);
      onPinchZoom?.(next, true);
    },
    [onPinchZoom]
  );

  const beginPinch = useCallback(() => {
    setPinching(true);
  }, []);

  useEffect(() => {
    if (pinching) return;
    const z = Number.isFinite(zoom) ? zoom : 1;
    zoomShared.value = z;
    baseZoom.value = z;
  }, [zoom, zoomShared, baseZoom, pinching]);

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

  const panX = typeof pan?.x === "number" ? pan.x : 0;
  const panY = typeof pan?.y === "number" ? pan.y : 0;

  const animatedTransform = useAnimatedStyle(() => ({
    transform: [{ scale: zoomShared.value }],
  }));

  const pinchGesture = React.useMemo(() => {
    if (!pinchEnabled || !onPinchZoom) return null;
    return Gesture.Pinch()
      .enabled(pinchEnabled)
      .onBegin(() => {
        "worklet";
        baseZoom.value = zoomShared.value;
        runOnJS(beginPinch)();
      })
      .onUpdate((e) => {
        "worklet";
        zoomShared.value = clampZoom(baseZoom.value * e.scale);
      })
      .onEnd(() => {
        "worklet";
        runOnJS(commitZoom)(zoomShared.value);
      })
      .onFinalize(() => {
        "worklet";
        runOnJS(setPinching)(false);
      });
  }, [pinchEnabled, beginPinch, commitZoom, zoomShared, baseZoom]);

  const content = (
    <View style={styles.wrap}>
      <Animated.View style={[styles.transformLayer, animatedTransform]}>
        <View
          style={[
            styles.panLayer,
            { transform: [{ translateX: panX }, { translateY: panY }] },
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
      </Animated.View>
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
  panLayer: {
    flex: 1,
  },
  player: {
    flex: 1,
    backgroundColor: CLIP_BG,
  },
});
