import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { AppColors } from "../../theme";
import { radii, typography, useThemeColors } from "../../theme";

export type PillTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "brand";
export type PillProps = {
  label: string;
  tone?: PillTone;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
};

/** Status chip — used for "Upcoming", "Live", "Cancelled" tags etc. */
export function Pill({ label, tone = "neutral", icon, style }: PillProps) {
  const c = useThemeColors();
  const p = getPalette(tone, c);
  return (
    <View style={[styles.wrap, { backgroundColor: p.bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={p.text} style={{ marginRight: 4 }} /> : null}
      <Text style={[typography.label, { color: p.text, fontSize: 12 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function getPalette(tone: PillTone, c: AppColors) {
  switch (tone) {
    case "info":
      return { bg: c.infoSubtle, text: c.info };
    case "success":
      return { bg: c.successSubtle, text: c.successText };
    case "warning":
      return { bg: c.warningSubtle, text: c.warningText };
    case "danger":
      return { bg: c.dangerSubtle, text: c.dangerText };
    case "brand":
      return { bg: c.brandSubtle, text: c.brand };
    case "neutral":
    default:
      return { bg: c.surfaceMuted, text: c.textMuted };
  }
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
});
