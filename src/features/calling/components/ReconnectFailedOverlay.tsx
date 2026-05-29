import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { meetingTheme } from "../meetingTheme";

type Props = {
  onRejoin: () => void;
  onLeave: () => void;
};

/**
 * Blocks live call controls after socket `reconnect_failed` (10 attempts).
 * User can rejoin without being trapped in a zombie meeting UI.
 */
export function ReconnectFailedOverlay({ onRejoin, onLeave }: Props) {
  return (
    <View style={styles.backdrop} accessibilityViewIsModal>
      <View style={styles.card}>
        <Text style={styles.title}>Connection lost</Text>
        <Text style={styles.body}>
          We could not restore your lesson connection. Check Wi‑Fi or switch to
          cellular, then tap Rejoin. You can also leave and open the lesson again
          from your dashboard.
        </Text>
        <Pressable style={styles.primary} onPress={onRejoin} accessibilityRole="button">
          <Text style={styles.primaryText}>Rejoin lesson</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onLeave} accessibilityRole="button">
          <Text style={styles.secondaryText}>Leave call</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: meetingTheme.surfaceElevated,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: meetingTheme.text,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: meetingTheme.textMuted,
  },
  primary: {
    backgroundColor: meetingTheme.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondary: {
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: {
    color: meetingTheme.textMuted,
    fontWeight: "600",
    fontSize: 15,
  },
});
