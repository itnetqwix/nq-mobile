import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { space, typography, useThemeColors } from "../../../theme";

type Props = { label: string };

export function ChatDaySeparator({ label }: Props) {
  const c = useThemeColors();
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <View style={[styles.pill, { backgroundColor: c.chatDayPill }]}>
        <Text style={[styles.text, { color: c.chatDayPillText }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: space.sm,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  text: {
    ...typography.caption,
    fontWeight: "600",
  },
});
