import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useRef } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Props = {
  isPlaying: boolean;
  progressSeconds: number;
  durationSeconds: number;
  isBuffering?: boolean;
  onTogglePlay: () => void;
  onSeek?: (seconds: number) => void;
  /** Overlay on video (default) or docked bar below the frame. */
  variant?: "overlay" | "dock";
  size?: "default" | "large";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function NetQwixVideoControls({
  isPlaying,
  progressSeconds,
  durationSeconds,
  isBuffering = false,
  onTogglePlay,
  onSeek,
  variant = "overlay",
  size = "default",
  disabled = false,
  style,
}: Props) {
  const trackW = useRef(1);
  const large = size === "large";
  const docked = variant === "dock";
  const max = Math.max(durationSeconds, 0.01);
  const value = Math.max(0, Math.min(progressSeconds, max));
  const ratio = value / max;
  const canSeek = !!onSeek && durationSeconds > 0 && !disabled;

  const seekFromX = useCallback(
    (locationX: number) => {
      if (!canSeek) return;
      const next = (locationX / trackW.current) * max;
      onSeek?.(Math.max(0, Math.min(max, next)));
    },
    [canSeek, max, onSeek]
  );

  const seekFromEvent = useCallback(
    (e: GestureResponderEvent) => {
      seekFromX(e.nativeEvent.locationX);
    },
    [seekFromX]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canSeek,
        onMoveShouldSetPanResponder: () => canSeek,
        onPanResponderGrant: (evt) => seekFromX(evt.nativeEvent.locationX),
        onPanResponderMove: (evt) => seekFromX(evt.nativeEvent.locationX),
        onPanResponderRelease: (evt) => seekFromX(evt.nativeEvent.locationX),
      }),
    [canSeek, seekFromX]
  );

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    trackW.current = e.nativeEvent.layout.width || 1;
  }, []);

  return (
    <View
      style={[
        docked ? styles.dockBar : styles.overlayBar,
        large && (docked ? styles.dockBarLarge : styles.overlayBarLarge),
        style,
      ]}
      pointerEvents="box-none"
    >
      {!docked ? <View style={styles.scrim} pointerEvents="none" /> : null}

      <Pressable
        onPress={onTogglePlay}
        style={({ pressed }) => [
          styles.playBtn,
          large && styles.playBtnLarge,
          pressed && !disabled && styles.playBtnPressed,
          disabled && styles.disabled,
        ]}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Pause" : "Play"}
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={large ? 26 : 22}
          color="#fff"
          style={!isPlaying ? styles.playIconOffset : undefined}
        />
      </Pressable>

      <View style={styles.trackCol}>
        <View
          {...(canSeek ? panResponder.panHandlers : {})}
          onLayout={onTrackLayout}
          style={[styles.trackHit, large && styles.trackHitLarge]}
        >
          <Pressable
            onPress={seekFromEvent}
            disabled={!canSeek}
            style={styles.trackPress}
            accessibilityRole="adjustable"
            accessibilityLabel="Seek"
          >
            <View style={[styles.track, large && styles.trackLarge]}>
              <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
              {canSeek ? (
                <View
                  style={[
                    styles.thumb,
                    large && styles.thumbLarge,
                    { left: `${ratio * 100}%` },
                  ]}
                />
              ) : null}
              {isBuffering ? <View style={styles.bufferPulse} /> : null}
            </View>
          </Pressable>
        </View>
        <View style={styles.times}>
          <Text style={[styles.time, large && styles.timeLarge]}>
            {formatTime(progressSeconds)}
          </Text>
          <Text style={[styles.time, large && styles.timeLarge]}>
            {formatTime(durationSeconds)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 32,
    gap: 10,
  },
  overlayBarLarge: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 40,
    gap: 12,
  },
  dockBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: "#0f172a",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  dockBarLarge: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,128,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  playBtnLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  playBtnPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  playIconOffset: { marginLeft: 2 },
  disabled: { opacity: 0.45 },
  trackCol: { flex: 1, gap: 6, paddingBottom: 4 },
  trackHit: { paddingVertical: 10 },
  trackHitLarge: { paddingVertical: 12 },
  trackPress: { width: "100%" },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "visible",
    justifyContent: "center",
  },
  trackLarge: { height: 6, borderRadius: 3 },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderRadius: 3,
  },
  thumb: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    top: -4.5,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "rgba(0,0,128,0.85)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
  thumbLarge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    top: -5,
  },
  bufferPulse: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 3,
    opacity: 0.65,
  },
  times: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  time: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  timeLarge: { fontSize: 12 },
});
