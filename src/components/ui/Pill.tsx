import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, radii, typography } from "../../theme";

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
  const p = getPalette(tone);
  return (
    <View style={[styles.wrap, { backgroundColor: p.bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={p.text} style={{ marginRight: 4 }} /> : null}
      <Text style={[typography.label, { color: p.text, fontSize: 12 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function getPalette(tone: PillTone) {
  switch (tone) {
    case "info":
      return { bg: colors.infoSubtle, text: colors.info };
    case "success":
      return { bg: colors.successSubtle, text: colors.successText };
    case "warning":
      return { bg: colors.warningSubtle, text: colors.warningText };
    case "danger":
      return { bg: colors.dangerSubtle, text: colors.dangerText };
    case "brand":
      return { bg: colors.brandSubtle, text: colors.brand };
    case "neutral":
    default:
      return { bg: colors.neutral100, text: colors.neutral700 };
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
