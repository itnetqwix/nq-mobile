import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  isPlaying: boolean;
  progressSeconds: number;
  durationSeconds: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  disabled?: boolean;
  bottomOffset?: number;
  /** `inline` anchors to parent pane; `floating` uses absolute bottom on meeting surface. */
  variant?: "floating" | "inline";
  /** Per-pane expand (dual-clip mode). */
  showExpand?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
};

/** Trainer-only clip timeline (play/pause + scrub). Trainee follows via socket. */
export function ClipPlaybackControls({
  isPlaying,
  progressSeconds,
  durationSeconds,
  onTogglePlay,
  onSeek,
  disabled,
  bottomOffset = 108,
  variant = "floating",
  showExpand,
  isExpanded,
  onToggleExpand,
}: Props) {
  const trackWidth = useRef(1);
  const max = Math.max(durationSeconds, 0.01);
  const value = Math.min(Math.max(progressSeconds, 0), max);
  const ratio = value / max;

  const seekFromEvent = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    const w = trackWidth.current || 1;
    onSeek(Math.max(0, Math.min(max, (x / w) * max)));
  };

  return (
    <View
      style={[
        styles.bar,
        variant === "floating" ? { bottom: bottomOffset } : styles.barInline,
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.timelineCard}>
        <Pressable
          style={[styles.playBtn, disabled && styles.btnDisabled]}
          onPress={onTogglePlay}
          disabled={disabled}
          accessibilityLabel={isPlaying ? "Pause clip" : "Play clip"}
        >
          <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="#fff" />
        </Pressable>

        <View style={styles.timelineCol}>
          <Pressable
            onLayout={(e: LayoutChangeEvent) => {
              trackWidth.current = e.nativeEvent.layout.width;
            }}
            onPress={seekFromEvent}
            disabled={disabled}
            style={styles.trackHit}
            accessibilityRole="adjustable"
            accessibilityLabel="Clip timeline"
          >
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
              <View style={[styles.thumb, { left: `${ratio * 100}%` }]} />
            </View>
          </Pressable>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(value)}</Text>
            <Text style={styles.timeText}>{formatTime(max)}</Text>
          </View>
        </View>
        {showExpand && onToggleExpand ? (
          <Pressable
            style={styles.expandBtn}
            onPress={onToggleExpand}
            accessibilityLabel={isExpanded ? "Exit expanded clip" : "Expand clip"}
          >
            <Ionicons
              name={isExpanded ? "contract-outline" : "expand-outline"}
              size={22}
              color="#fff"
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 24,
  },
  barInline: {
    position: "relative",
    left: 0,
    right: 0,
    bottom: 0,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  timelineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,128,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.4 },
  timelineCol: { flex: 1 },
  trackHit: { paddingVertical: 8 },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "visible",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#4fc3f7",
    borderRadius: 2,
  },
  thumb: {
    position: "absolute",
    top: -6,
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  timeText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "600",
  },
  expandBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
