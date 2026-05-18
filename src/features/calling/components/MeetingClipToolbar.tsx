import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ClipLayoutMode } from "../useClipSync";

type Props = {
  layoutMode: ClipLayoutMode;
  lockMode: boolean;
  drawingEnabled: boolean;
  hasClip: boolean;
  dualClip: boolean;
  onToggleFullscreen: () => void;
  onToggleStacked: () => void;
  onToggleLock: () => void;
  onToggleDrawing: () => void;
  onClearDrawing: () => void;
  bottomOffset: number;
};

export function MeetingClipToolbar({
  layoutMode,
  lockMode,
  drawingEnabled,
  hasClip,
  dualClip,
  onToggleFullscreen,
  onToggleStacked,
  onToggleLock,
  onToggleDrawing,
  onClearDrawing,
  bottomOffset,
}: Props) {
  if (!hasClip) return null;

  return (
    <View style={[styles.row, { bottom: bottomOffset }]} pointerEvents="box-none">
      <ToolbarChip
        icon={layoutMode === "clipFullscreen" ? "contract-outline" : "expand-outline"}
        label={layoutMode === "clipFullscreen" ? "Exit full" : "Full clip"}
        onPress={onToggleFullscreen}
      />
      {dualClip ? (
        <ToolbarChip
          icon="albums-outline"
          label={layoutMode === "stacked" ? "Single" : "Stack"}
          active={layoutMode === "stacked"}
          onPress={onToggleStacked}
        />
      ) : null}
      <ToolbarChip
        icon={lockMode ? "lock-closed" : "lock-open-outline"}
        label="Lock"
        active={lockMode}
        onPress={onToggleLock}
        disabled={!dualClip}
      />
      <ToolbarChip
        icon="brush-outline"
        label={drawingEnabled ? "Draw on" : "Draw"}
        active={drawingEnabled}
        onPress={onToggleDrawing}
      />
      {drawingEnabled ? (
        <ToolbarChip icon="trash-outline" label="Clear" onPress={onClearDrawing} />
      ) : null}
    </View>
  );
}

function ToolbarChip({
  icon,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={16} color="#fff" />
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    zIndex: 22,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: "rgba(0,0,128,0.9)",
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
