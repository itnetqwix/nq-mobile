import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, space } from "../../../theme";
import { SessionCountdownText } from "../../sessions/components/SessionCountdownText";

type Props = {
  deadlineMs: number;
  label: string;
  variant?: "default" | "urgent";
  onExpired?: () => void;
};

export function InstantLessonDeadlineChip({
  deadlineMs,
  label,
  variant = "default",
  onExpired,
}: Props) {
  return (
    <View style={[styles.wrap, variant === "urgent" && styles.wrapUrgent]}>
      <Text style={[styles.label, variant === "urgent" && styles.labelUrgent]}>{label}</Text>
      <SessionCountdownText
        deadlineMs={deadlineMs}
        label=""
        onExpired={onExpired}
        timeOnly
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 6,
    paddingHorizontal: space.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    alignSelf: "flex-start",
  },
  wrapUrgent: {
    backgroundColor: "#fff3e0",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  labelUrgent: {
    color: "#e65100",
  },
  countdown: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.brandNavy,
    fontVariant: ["tabular-nums"],
  },
});
