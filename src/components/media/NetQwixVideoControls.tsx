import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

type Props = {
  isPlaying: boolean;
  progressSeconds: number;
  durationSeconds: number;
  isBuffering?: boolean;
  onTogglePlay: () => void;
  onSeek?: (seconds: number) => void;
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
}: Props) {
  const trackW = React.useRef(1);
  const ratio =
    durationSeconds > 0
      ? Math.max(0, Math.min(1, progressSeconds / durationSeconds))
      : 0;

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    trackW.current = e.nativeEvent.layout.width || 1;
  }, []);

  const onTrackPress = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      if (!onSeek || durationSeconds <= 0) return;
      const x = e.nativeEvent.locationX;
      const next = (x / trackW.current) * durationSeconds;
      onSeek(Math.max(0, Math.min(durationSeconds, next)));
    },
    [durationSeconds, onSeek]
  );

  return (
    <View style={styles.bar} pointerEvents="box-none">
      <View style={styles.scrim} pointerEvents="none" />
      <Pressable
        onPress={onTogglePlay}
        style={styles.playBtn}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Pause" : "Play"}
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={22}
          color="#fff"
        />
      </Pressable>
      <View style={styles.trackCol}>
        <Pressable
          onPress={onTrackPress}
          onLayout={onTrackLayout}
          style={styles.trackHit}
          disabled={!onSeek || durationSeconds <= 0}
          accessibilityRole="adjustable"
          accessibilityLabel="Seek"
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
            {isBuffering ? <View style={styles.bufferPulse} /> : null}
          </View>
        </Pressable>
        <View style={styles.times}>
          <Text style={styles.time}>{formatTime(progressSeconds)}</Text>
          <Text style={styles.time}>{formatTime(durationSeconds)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 28,
    gap: 10,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,128,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  trackCol: { flex: 1, gap: 4, paddingBottom: 6 },
  trackHit: { paddingVertical: 8 },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  bufferPulse: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.35)",
    opacity: 0.6,
  },
  times: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  time: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
