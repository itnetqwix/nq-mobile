import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { meetingTheme } from "../meetingTheme";

type Props = {
  focusedClipTitle: string | null;
  topOffset?: number;
};

/** Trainee-facing banner when the coach sets a focused clip for review. */
export function MeetingAgendaBanner({ focusedClipTitle, topOffset = 96 }: Props) {
  if (!focusedClipTitle) return null;

  return (
    <View style={[styles.wrap, { top: topOffset }]} pointerEvents="none">
      <View style={styles.card}>
        <Ionicons name="eye-outline" size={16} color={meetingTheme.navy} />
        <View style={styles.copy}>
          <Text style={styles.kicker}>Coach is reviewing</Text>
          <Text style={styles.title} numberOfLines={1}>
            {focusedClipTitle}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 24,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: meetingTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: meetingTheme.border,
  },
  copy: { flex: 1 },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    color: meetingTheme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: meetingTheme.text,
    marginTop: 2,
  },
});
