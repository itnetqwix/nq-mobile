import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
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

function getControlMetrics(size: "default" | "compact" | "slim"): ControlMetrics {
  if (size === "slim") {
    return {
      trackHeight: 3,
      trackRowHeight: 24,
      thumbSize: 12,
      playBtnSize: 26,
      playIconSize: 12,
    };
  }
  const compact = size === "compact";
  const trackHeight = compact ? 4 : 5;
  const thumbSize = compact ? 14 : 16;
  const playBtnSize = compact ? 32 : 36;
  const trackRowHeight = Math.max(thumbSize + 12, compact ? 36 : 44);
  return {
    trackHeight,
    trackRowHeight,
    thumbSize,
    playBtnSize,
    playIconSize: compact ? 14 : 16,
  };
}

type Props = {
  isPlaying: boolean;
  progressSeconds: number;
  durationSeconds: number;
  onTogglePlay: () => void;
  /** `commit` false while scrubbing; true on release / tap. */
  onSeek: (seconds: number, commit?: boolean) => void;
  disabled?: boolean;
  /** When false, timeline is display-only (locked dual-clip playback). */
  seekEnabled?: boolean;
  bottomOffset?: number;
  /** `inline` anchors to parent pane; `floating` uses absolute bottom on meeting surface. */
  variant?: "floating" | "inline";
  /** Per-pane expand (dual-clip mode). */
  showExpand?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  /** Smaller play button, track, and labels for shared dual-clip bar. */
  size?: "default" | "compact" | "slim";
  /** Hide elapsed/total labels (inline dual-clip panes). */
  hideTimeLabels?: boolean;
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
  seekEnabled = true,
  bottomOffset = 108,
  variant = "floating",
  showExpand,
  isExpanded,
  onToggleExpand,
  size = "default",
  hideTimeLabels = false,
  onLightBackground = false,
}: Props) {
  const metrics = useMemo(() => getControlMetrics(size), [size]);
  const light = onLightBackground;
  const trackWidthRef = useRef(1);
  const [trackWidthPx, setTrackWidthPx] = useState(1);
  const [scrubbing, setScrubbing] = useState(false);
  const max = Math.max(durationSeconds, 0.01);
  const value = Math.min(Math.max(progressSeconds, 0), max);
  const ratio = value / max;

  const seekFromX = (locationX: number, commit = true) => {
    const w = trackWidthRef.current || 1;
    onSeek(Math.max(0, Math.min(max, (locationX / w) * max)), commit);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled && seekEnabled,
        onMoveShouldSetPanResponder: () => !disabled && seekEnabled,
        onPanResponderGrant: (evt) => {
          setScrubbing(true);
          seekFromX(evt.nativeEvent.locationX, false);
        },
        onPanResponderMove: (evt) => seekFromX(evt.nativeEvent.locationX, false),
        onPanResponderRelease: (evt) => {
          seekFromX(evt.nativeEvent.locationX, true);
          setScrubbing(false);
        },
        onPanResponderTerminate: () => setScrubbing(false),
      }),
    [disabled, max, onSeek, seekEnabled]
  );

  const thumbLeft = Math.max(
    0,
    Math.min(
      Math.max(trackWidthPx - metrics.thumbSize, 0),
      ratio * trackWidthPx - metrics.thumbSize / 2
    )
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
          (size === "compact" || size === "slim") && styles.timelineCardCompact,
          size === "slim" && styles.timelineCardSlim,
          isInline && styles.timelineCardInline,
          light && styles.timelineCardLight,
          scrubbing && styles.timelineCardScrubbing,
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.playBtn,
            {
              width: metrics.playBtnSize,
              height: metrics.playBtnSize,
              borderRadius: metrics.playBtnSize / 2,
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
            style={[
              styles.trackRow,
              {
                height: metrics.trackRowHeight,
                minHeight: size === "slim" ? 28 : 44,
              },
            ]}
            accessibilityRole="adjustable"
            accessibilityLabel="Clip timeline"
            accessibilityValue={{
              min: 0,
              max: Math.round(max),
              now: Math.round(value),
            }}
          >
            <View style={[styles.trackLane, { height: metrics.trackRowHeight }]}>
              <View style={styles.trackCenter}>
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
              </View>
              <View
                pointerEvents="none"
                style={[
                  styles.thumb,
                  scrubbing && styles.thumbActive,
                  {
                    width: metrics.thumbSize,
                    height: metrics.thumbSize,
                    borderRadius: metrics.thumbSize / 2,
                    left: thumbLeft,
                    top: metrics.trackRowHeight / 2,
                    marginTop: -metrics.thumbSize / 2,
                    borderColor: light ? "#000080" : meetingTheme.navy,
                  },
                ]}
              />
            </View>
          </View>
          {!hideTimeLabels ? (
            <View style={styles.timeRow}>
              <Text
                style={[
                  styles.timeText,
                  (size === "compact" || size === "slim") && styles.timeTextCompact,
                  light && styles.timeTextLight,
                ]}
              >
                {formatTime(value)}
              </Text>
              <Text
                style={[
                  styles.timeMuted,
                  (size === "compact" || size === "slim") && styles.timeTextCompact,
                  light && styles.timeMutedLight,
                ]}
              >
                {formatTime(max)}
              </Text>
            </View>
          ) : null}
        </View>

        {showExpand && onToggleExpand ? (
          <Pressable
            style={({ pressed }) => [
              styles.expandBtn,
              isExpanded && styles.expandBtnActive,
              (size === "compact" || size === "slim") && styles.expandBtnCompact,
              pressed && { opacity: 0.85 },
            ]}
            onPress={onToggleExpand}
            accessibilityLabel={isExpanded ? "Exit expanded clip" : "Expand clip"}
          >
            <Ionicons
              name={isExpanded ? "contract-outline" : "expand-outline"}
              size={size === "slim" ? 14 : size === "compact" ? 16 : 18}
              color={isExpanded ? meetingTheme.onPrimary : meetingTheme.text}
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
    left: 10,
    right: 10,
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
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: meetingTheme.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  timelineCardInline: {
    backgroundColor: "rgba(248,249,252,0.98)",
    borderColor: "rgba(0,0,0,0.08)",
    shadowOpacity: 0,
    elevation: 0,
    marginHorizontal: 4,
    borderRadius: 12,
  },
  timelineCardLight: {
    backgroundColor: "#f0f3f8",
    borderColor: "rgba(0,0,8,0.12)",
  },
  timelineCardScrubbing: {
    borderColor: meetingTheme.navy,
  },
  timelineCardCompact: {
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  timelineCardSlim: {
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
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
    position: "relative",
    justifyContent: "center",
  },
  trackCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
  },
  track: {
    width: "100%",
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.12)",
    overflow: "hidden",
  },
  trackLight: {
    backgroundColor: "rgba(0,0,8,0.14)",
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
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  thumbActive: {
    transform: [{ scale: 1.12 }],
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingHorizontal: 2,
  },
  timeText: {
    color: meetingTheme.text,
    fontSize: 11,
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
  },
  timeMutedLight: {
    color: "#5c6370",
  },
  expandBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  expandBtnActive: {
    backgroundColor: meetingTheme.navy,
  },
  expandBtnCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
