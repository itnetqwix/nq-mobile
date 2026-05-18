import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const FRAME_STEP_SEC = 1 / 30;
const MIN_TOUCH = 44;

type Props = {
  isPlaying: boolean;
  onTogglePlay: () => void;
  progressSeconds: number;
  onStepFrame: (nextSeconds: number) => void;
  disabled?: boolean;
  bottomOffset?: number;
};

export function ClipPlaybackControls({
  isPlaying,
  onTogglePlay,
  progressSeconds,
  onStepFrame,
  disabled,
  bottomOffset = 108,
}: Props) {
  return (
    <View style={[styles.bar, { bottom: bottomOffset }]} pointerEvents="box-none">
      <Pressable
        style={[styles.frameBtn, disabled && styles.btnDisabled]}
        onPress={() => onStepFrame(Math.max(0, progressSeconds - FRAME_STEP_SEC))}
        disabled={disabled}
        accessibilityLabel="Previous frame"
        accessibilityHint="Step back one frame"
      >
        <Ionicons name="chevron-back" size={26} color="#fff" />
        <Text style={styles.frameLabel}>−1 frame</Text>
      </Pressable>

      <Pressable
        style={[styles.playBtn, disabled && styles.btnDisabled]}
        onPress={onTogglePlay}
        disabled={disabled}
        accessibilityLabel={isPlaying ? "Pause clip" : "Play clip"}
      >
        <Ionicons name={isPlaying ? "pause" : "play"} size={34} color="#fff" />
        <Text style={styles.playLabel}>{isPlaying ? "Pause" : "Play"}</Text>
      </Pressable>

      <Pressable
        style={[styles.frameBtn, disabled && styles.btnDisabled]}
        onPress={() => onStepFrame(progressSeconds + FRAME_STEP_SEC)}
        disabled={disabled}
        accessibilityLabel="Next frame"
        accessibilityHint="Step forward one frame"
      >
        <Ionicons name="chevron-forward" size={26} color="#fff" />
        <Text style={styles.frameLabel}>+1 frame</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 16,
    zIndex: 20,
  },
  frameBtn: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  playBtn: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
    minHeight: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,128,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btnDisabled: { opacity: 0.4 },
  frameLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  playLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
});
