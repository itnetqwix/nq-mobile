import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
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

type ControlMetrics = {
  trackHeight: number;
  trackRowHeight: number;
  thumbSize: number;
  playBtnSize: number;
  playIconSize: number;
};

function getControlMetrics(size: "default" | "compact", onLightBackground: boolean): ControlMetrics {
  const compact = size === "compact";
  const light = onLightBackground;
  const trackHeight = compact ? 3 : light ? 6 : 4;
  const thumbSize = compact ? 10 : light ? 16 : 14;
  const playBtnSize = compact ? 28 : 38;
  const trackRowHeight = Math.max(compact ? 24 : 28, thumbSize + 8);
  return {
    trackHeight,
    trackRowHeight,
    thumbSize,
    playBtnSize,
    playIconSize: compact ? 14 : 18,
  };
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
  const metrics = useMemo(
    () => getControlMetrics(size, onLightBackground),
    [size, onLightBackground]
  );
  const light = onLightBackground;
  const trackWidthRef = useRef(1);
  const [trackWidthPx, setTrackWidthPx] = useState(1);
  const max = Math.max(durationSeconds, 0.01);
  const value = Math.min(Math.max(progressSeconds, 0), max);
  const ratio = value / max;

  const seekFromX = (locationX: number) => {
    const w = trackWidthRef.current || 1;
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

  const thumbLeft = Math.max(
    0,
    Math.min(
      Math.max(trackWidthPx - metrics.thumbSize, 0),
      ratio * trackWidthPx - metrics.thumbSize / 2
    )
  );
  const playBtnMarginTop = (metrics.trackRowHeight - metrics.playBtnSize) / 2;
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
          size === "compact" && styles.timelineCardCompact,
          isInline && styles.timelineCardInline,
          light && styles.timelineCardLight,
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.playBtn,
            {
              width: metrics.playBtnSize,
              height: metrics.playBtnSize,
              borderRadius: metrics.playBtnSize / 2,
              marginTop: playBtnMarginTop,
            },
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
            size={metrics.playIconSize}
            color={meetingTheme.onPrimary}
            style={!isPlaying ? styles.playIconOffset : undefined}
          />
        </Pressable>

        <View style={styles.timelineCol}>
          <View
            onLayout={(e: LayoutChangeEvent) => {
              const w = e.nativeEvent.layout.width;
              trackWidthRef.current = w;
              setTrackWidthPx(w);
            }}
            {...panResponder.panHandlers}
            style={[styles.trackRow, { height: metrics.trackRowHeight }]}
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
            <View style={styles.trackLane}>
              <View
                style={[
                  styles.track,
                  { height: metrics.trackHeight },
                  light && styles.trackLight,
                ]}
              >
                <View
                  style={[
                    styles.fill,
                    light && styles.fillLight,
                    { width: `${ratio * 100}%` },
                  ]}
                />
              </View>
              <View
                pointerEvents="none"
                style={[
                  styles.thumb,
                  {
                    width: metrics.thumbSize,
                    height: metrics.thumbSize,
                    borderRadius: metrics.thumbSize / 2,
                    left: thumbLeft,
                    top: (metrics.trackRowHeight - metrics.thumbSize) / 2,
                    borderColor: light ? "#000080" : meetingTheme.navy,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.timeRow}>
            <Text
              style={[
                styles.timeText,
                size === "compact" && styles.timeTextCompact,
                light && styles.timeTextLight,
              ]}
            >
              {formatTime(value)}
            </Text>
            <Text
              style={[
                styles.timeMuted,
                size === "compact" && styles.timeTextCompact,
                light && styles.timeMutedLight,
              ]}
            >
              {formatTime(max)}
            </Text>
          </View>
        </View>

        {showExpand && onToggleExpand ? (
          <Pressable
            style={({ pressed }) => [
              styles.expandBtn,
              size === "compact" && styles.expandBtnCompact,
              { marginTop: playBtnMarginTop },
              pressed && { opacity: 0.85 },
            ]}
            onPress={onToggleExpand}
            accessibilityLabel={isExpanded ? "Exit expanded clip" : "Expand clip"}
          >
            <Ionicons
              name={isExpanded ? "contract-outline" : "expand-outline"}
              size={size === "compact" ? 18 : 22}
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
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: meetingTheme.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: meetingTheme.border,
    shadowColor: "#000",
    shadowOpacity: 0.1,
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
    backgroundColor: meetingTheme.navy,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
  trackRow: {
    width: "100%",
    justifyContent: "center",
  },
  trackLane: {
    width: "100%",
    justifyContent: "center",
  },
  track: {
    width: "100%",
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.14)",
    overflow: "hidden",
  },
  trackLight: {
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
    backgroundColor: "#fff",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
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
    flexShrink: 0,
  },
  expandBtnCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
});
