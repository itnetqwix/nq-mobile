import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { space, typography, useThemeColors } from "../../../theme";

type Props = { label: string };

/**
 * WhatsApp-style day divider: centered pill with hairlines on both sides.
 */
export function ChatDaySeparator({ label }: Props) {
  const c = useThemeColors();
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <View style={[styles.line, { backgroundColor: c.border }]} />
      <View
        style={[
          styles.pill,
          {
            backgroundColor: c.chatDayPill,
            shadowColor: "#000",
          },
        ]}
      >
        <Text style={[styles.text, { color: c.chatDayPillText }]}>{label}</Text>
      </View>
      <View style={[styles.line, { backgroundColor: c.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    opacity: 0.6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  text: {
    ...typography.caption,
    fontWeight: "600",
    fontSize: 11,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
});
