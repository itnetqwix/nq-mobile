import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography } from "../../../theme";

type Props = {
  deadlineMs: number;
  label: string;
  onExpired?: () => void;
  /** When true, render only mm:ss (for inline chips). */
  timeOnly?: boolean;
};

export function SessionCountdownText({ deadlineMs, label, onExpired, timeOnly }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000))
  );

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) onExpired?.();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineMs, onExpired]);

  const urgency = secondsLeft <= 10;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(1, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (timeOnly) {
    return (
      <Text style={[styles.timeOnly, urgency && styles.labelUrgent]}>
        {mm}:{ss}
      </Text>
    );
  }

  return (
    <View style={[styles.wrap, urgency && styles.wrapUrgent]}>
      <Ionicons name="timer-outline" size={18} color={urgency ? colors.danger : colors.brandNavy} />
      <Text style={[styles.label, urgency && styles.labelUrgent]}>
        {label}: {mm}:{ss}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  wrapUrgent: { backgroundColor: "#FEE2E2" },
  label: { ...typography.bodyMd, fontWeight: "700", color: colors.brandNavy },
  labelUrgent: { color: colors.danger },
  timeOnly: {
    ...typography.bodyMd,
    fontWeight: "700",
    color: colors.brandNavy,
    fontVariant: ["tabular-nums"],
  },
});
