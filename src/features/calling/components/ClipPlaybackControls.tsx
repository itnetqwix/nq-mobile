import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";

import { meetingTheme } from "../meetingTheme";

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
  /** Smaller play button, track, and labels for shared dual-clip bar. */
  size?: "default" | "compact";
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
  size = "default",
}: Props) {
  const compact = size === "compact";
  const trackWidth = useRef(1);
  const max = Math.max(durationSeconds, 0.01);
  const value = Math.min(Math.max(progressSeconds, 0), max);
  const ratio = value / max;

  const seekFromX = (locationX: number) => {
    const w = trackWidth.current || 1;
    onSeek(Math.max(0, Math.min(max, (locationX / w) * max)));
  };

  const seekFromEvent = (e: GestureResponderEvent) => {
    seekFromX(e.nativeEvent.locationX);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (evt) => seekFromX(evt.nativeEvent.locationX),
        onPanResponderMove: (evt) => seekFromX(evt.nativeEvent.locationX),
        onPanResponderRelease: (evt) => seekFromX(evt.nativeEvent.locationX),
      }),
    [disabled, max, onSeek]
  );

  const isInline = variant === "inline";

  return (
    <View
      style={[
        styles.bar,
        !isInline && { bottom: bottomOffset },
        isInline && styles.barInline,
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.timelineCard,
          compact && styles.timelineCardCompact,
          isInline && styles.timelineCardInline,
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.playBtn,
            compact && styles.playBtnCompact,
            disabled && styles.btnDisabled,
            pressed && !disabled && styles.playBtnPressed,
          ]}
          onPress={onTogglePlay}
          disabled={disabled}
          accessibilityLabel={isPlaying ? "Pause clip" : "Play clip"}
          accessibilityRole="button"
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={compact ? 18 : 24}
            color={meetingTheme.onPrimary}
            style={!isPlaying ? styles.playIconOffset : undefined}
          />
        </Pressable>

        <View style={styles.timelineCol}>
          <View
            onLayout={(e: LayoutChangeEvent) => {
              trackWidth.current = e.nativeEvent.layout.width;
            }}
            {...panResponder.panHandlers}
            style={[styles.trackHit, compact && styles.trackHitCompact]}
            accessibilityRole="adjustable"
            accessibilityLabel="Clip timeline"
            accessibilityValue={{
              min: 0,
              max: Math.round(max),
              now: Math.round(value),
            }}
          >
            <Pressable
              onPress={seekFromEvent}
              disabled={disabled}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.track, compact && styles.trackCompact]}>
              <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
            </View>
            <View
              style={[
                styles.thumb,
                compact && styles.thumbCompact,
                { left: `${ratio * 100}%` },
              ]}
            />
          </View>
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, compact && styles.timeTextCompact]}>
              {formatTime(value)}
            </Text>
            <Text style={[styles.timeMuted, compact && styles.timeTextCompact]}>
              {formatTime(max)}
            </Text>
          </View>
        </View>

        {showExpand && onToggleExpand ? (
          <Pressable
            style={({ pressed }) => [
              styles.expandBtn,
              compact && styles.expandBtnCompact,
              pressed && { opacity: 0.85 },
            ]}
            onPress={onToggleExpand}
            accessibilityLabel={isExpanded ? "Exit expanded clip" : "Expand clip"}
          >
            <Ionicons
              name={isExpanded ? "contract-outline" : "expand-outline"}
              size={compact ? 18 : 22}
              color={meetingTheme.text}
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
    marginTop: 0,
    paddingHorizontal: 0,
  },
  timelineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: meetingTheme.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: meetingTheme.border,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  timelineCardInline: {
    backgroundColor: "#f4f6f8",
    borderColor: "rgba(0,0,0,0.08)",
    shadowOpacity: 0,
    elevation: 0,
  },
  timelineCardCompact: {
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: meetingTheme.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtnCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  playBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  playIconOffset: {
    marginLeft: 2,
  },
  btnDisabled: { opacity: 0.4 },
  timelineCol: { flex: 1, minWidth: 0 },
  trackHit: {
    paddingVertical: 10,
    justifyContent: "center",
  },
  trackHitCompact: { paddingVertical: 6 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.12)",
    overflow: "hidden",
  },
  trackCompact: { height: 4 },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: meetingTheme.navy,
    borderRadius: 3,
  },
  thumb: {
    position: "absolute",
    top: "50%",
    marginTop: -9,
    marginLeft: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: meetingTheme.navy,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  thumbCompact: {
    marginTop: -7,
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingHorizontal: 2,
  },
  timeText: {
    color: meetingTheme.text,
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  timeMuted: {
    color: meetingTheme.textMuted,
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  timeTextCompact: {
    fontSize: 10,
  },
  expandBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  expandBtnCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
});
