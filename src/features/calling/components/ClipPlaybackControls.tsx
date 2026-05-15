import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const FRAME_STEP_SEC = 1 / 30;

type Props = {
  isPlaying: boolean;
  onTogglePlay: () => void;
  /** Current playhead in seconds (for frame step). */
  progressSeconds: number;
  onStepFrame: (nextSeconds: number) => void;
  disabled?: boolean;
};

export function ClipPlaybackControls({
  isPlaying,
  onTogglePlay,
  progressSeconds,
  onStepFrame,
  disabled,
}: Props) {
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <Pressable
        style={[styles.btn, disabled && styles.btnDisabled]}
        onPress={() => onStepFrame(Math.max(0, progressSeconds - FRAME_STEP_SEC))}
        disabled={disabled}
        accessibilityLabel="Previous frame"
      >
        <Ionicons name="play-skip-back" size={22} color="#fff" />
        <Text style={styles.btnLabel}>Frame</Text>
      </Pressable>

      <Pressable
        style={[styles.btn, styles.playBtn, disabled && styles.btnDisabled]}
        onPress={onTogglePlay}
        disabled={disabled}
        accessibilityLabel={isPlaying ? "Pause" : "Play"}
      >
        <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="#fff" />
      </Pressable>

      <Pressable
        style={[styles.btn, disabled && styles.btnDisabled]}
        onPress={() => onStepFrame(progressSeconds + FRAME_STEP_SEC)}
        disabled={disabled}
        accessibilityLabel="Next frame"
      >
        <Ionicons name="play-skip-forward" size={22} color="#fff" />
        <Text style={styles.btnLabel}>Frame</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 108,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    zIndex: 20,
  },
  btn: {
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,128,0.85)",
  },
  btnDisabled: { opacity: 0.4 },
  btnLabel: { color: "rgba(255,255,255,0.85)", fontSize: 10, marginTop: 2 },
});
