import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { meetingTheme } from "../meetingTheme";

type Props = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  tone?: "info" | "accent" | "danger";
};

/** Small stage chip for coach-controlled modes (clips, drawing). */
export function MeetingCoachChip({ icon, label, tone = "info" }: Props) {
  const bg =
    tone === "danger"
      ? "rgba(211, 47, 47, 0.92)"
      : tone === "accent"
        ? "rgba(0, 0, 128, 0.88)"
        : "rgba(0, 0, 0, 0.62)";
  return (
    <View style={[styles.chip, { backgroundColor: bg }]} pointerEvents="none">
      <Ionicons name={icon} size={14} color="#fff" />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  text: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
