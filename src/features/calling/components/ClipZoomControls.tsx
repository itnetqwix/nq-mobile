/**
 * Per-clip zoom +/- (web clip-mode.jsx parity; replaces pinch).
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  disabled?: boolean;
};

export function ClipZoomControls({ onZoomIn, onZoomOut, disabled }: Props) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        style={[styles.btn, disabled && styles.btnDisabled]}
        onPress={onZoomIn}
        disabled={disabled}
        hitSlop={8}
        accessibilityLabel="Zoom in"
      >
        <Ionicons name="add-circle-outline" size={28} color="#000080" />
      </Pressable>
      <Pressable
        style={[styles.btn, disabled && styles.btnDisabled]}
        onPress={onZoomOut}
        disabled={disabled}
        hitSlop={8}
        accessibilityLabel="Zoom out"
      >
        <Ionicons name="remove-circle-outline" size={28} color="#000080" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 12,
    gap: 6,
    alignItems: "center",
  },
  btn: {
    opacity: 1,
  },
  btnDisabled: {
    opacity: 0.4,
  },
});
