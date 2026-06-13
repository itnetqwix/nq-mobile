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
  /** Higher-contrast timeline when sitting on a white clip stage. */
  onLightBackground?: boolean;
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
  onLightBackground = false,
}: Props) {
  const compact = size === "compact";
  const light = onLightBackground;
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
          light && styles.timelineCardLight,
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
            size={compact ? 14 : 18}
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
            <View style={[styles.track, compact && styles.trackCompact, light && styles.trackLight]}>
              <View
                style={[
                  styles.fill,
                  light && styles.fillLight,
                  { width: `${ratio * 100}%` },
                ]}
              />
            </View>
            <View
              style={[
                styles.thumb,
                compact && styles.thumbCompact,
                light && styles.thumbLight,
                { left: `${ratio * 100}%` },
              ]}
            />
          </View>
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, compact && styles.timeTextCompact, light && styles.timeTextLight]}>
              {formatTime(value)}
            </Text>
            <Text style={[styles.timeMuted, compact && styles.timeTextCompact, light && styles.timeMutedLight]}>
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
    alignSelf: "stretch",
  },
  timelineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: meetingTheme.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: meetingTheme.border,
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  timelineCardInline: {
    backgroundColor: "rgba(240,242,246,0.98)",
    borderColor: "rgba(0,0,0,0.08)",
    shadowOpacity: 0,
    elevation: 0,
    marginHorizontal: 4,
  },
  timelineCardLight: {
    backgroundColor: "#f0f2f6",
    borderColor: "rgba(0,0,0,0.12)",
    paddingVertical: 8,
  },
  timelineCardCompact: {
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: meetingTheme.navy,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  playBtnCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    paddingVertical: 8,
    justifyContent: "center",
  },
  trackHitCompact: { paddingVertical: 5 },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.14)",
    overflow: "hidden",
  },
  trackCompact: { height: 3 },
  trackLight: {
    height: 6,
    backgroundColor: "rgba(0,0,8,0.16)",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: meetingTheme.navy,
    borderRadius: 3,
  },
  fillLight: {
    backgroundColor: "#000080",
  },
  thumb: {
    position: "absolute",
    top: "50%",
    marginTop: -7,
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: meetingTheme.navy,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  thumbCompact: {
    marginTop: -5,
    marginLeft: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  thumbLight: {
    marginTop: -8,
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderColor: "#000080",
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
    paddingHorizontal: 1,
  },
  timeText: {
    color: meetingTheme.text,
    fontSize: 10,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  timeMuted: {
    color: meetingTheme.textMuted,
    fontSize: 10,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  timeTextCompact: {
    fontSize: 9,
  },
  timeTextLight: {
    color: "#1a1a2e",
    fontSize: 11,
  },
  timeMutedLight: {
    color: "#5c6370",
    fontSize: 11,
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
