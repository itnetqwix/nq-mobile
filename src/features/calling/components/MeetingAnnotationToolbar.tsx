/**
 * Trainer annotation toolbar — shapes, color picker, text tool (web menubar parity).
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export type AnnotationTool =
  | "freehand"
  | "line"
  | "rect"
  | "circle"
  | "arrow"
  | "text";

const STROKE_COLORS = [
  "#ff3b30",
  "#ff9800",
  "#ffeb3b",
  "#4caf50",
  "#2196f3",
  "#9c27b0",
  "#ffffff",
];

type Props = {
  tool: AnnotationTool;
  strokeColor: string;
  onToolChange: (tool: AnnotationTool) => void;
  onColorChange: (color: string) => void;
  drawingEnabled: boolean;
  onToggleDrawing: () => void;
  onClear: () => void;
  bottomOffset?: number;
};

const TOOLS: {
  id: AnnotationTool;
  icon: keyof typeof Ionicons.glyphMap | string;
  lib: "ion" | "mci";
}[] = [
  { id: "freehand", icon: "gesture", lib: "mci" },
  { id: "line", icon: "remove", lib: "ion" },
  { id: "rect", icon: "square-outline", lib: "ion" },
  { id: "circle", icon: "ellipse-outline", lib: "ion" },
  { id: "arrow", icon: "arrow-forward", lib: "ion" },
  { id: "text", icon: "text", lib: "ion" },
];

export function MeetingAnnotationToolbar({
  tool,
  strokeColor,
  onToolChange,
  onColorChange,
  drawingEnabled,
  onToggleDrawing,
  onClear,
  bottomOffset = 160,
}: Props) {
  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.row}>
        <Pressable
          onPress={onToggleDrawing}
          style={[styles.chip, drawingEnabled && styles.chipActive]}
          accessibilityLabel={drawingEnabled ? "Turn drawing off" : "Turn drawing on"}
        >
          <MaterialCommunityIcons
            name="draw"
            size={18}
            color={drawingEnabled ? "#fff" : "#ccc"}
          />
          <Text style={styles.chipText}>{drawingEnabled ? "Draw on" : "Draw"}</Text>
        </Pressable>

        {drawingEnabled ? (
          <>
            {TOOLS.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => onToolChange(t.id)}
                style={[styles.toolBtn, tool === t.id && styles.toolBtnActive]}
                accessibilityLabel={t.id}
              >
                {t.lib === "mci" ? (
                  <MaterialCommunityIcons name={t.icon as any} size={20} color="#fff" />
                ) : (
                  <Ionicons name={t.icon as any} size={20} color="#fff" />
                )}
              </Pressable>
            ))}

            <View style={styles.colorRow}>
              {STROKE_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => onColorChange(c)}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    strokeColor === c && styles.colorSwatchActive,
                  ]}
                  accessibilityLabel={`Color ${c}`}
                />
              ))}
            </View>

            <Pressable onPress={onClear} style={styles.toolBtn} accessibilityLabel="Clear">
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    alignItems: "center",
    zIndex: 28,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.65)",
    maxWidth: "96%",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  chipActive: {
    backgroundColor: "rgba(76,175,80,0.45)",
  },
  chipText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  toolBtnActive: {
    backgroundColor: "rgba(33,150,243,0.55)",
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  colorSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchActive: {
    borderColor: "#fff",
  },
});
