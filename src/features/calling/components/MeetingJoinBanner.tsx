import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { meetingTheme } from "../meetingTheme";

type Props = {
  message: string;
  variant?: "info" | "success";
  onDismiss?: () => void;
  topOffset?: number;
};

export function MeetingJoinBanner({
  message,
  variant = "info",
  onDismiss,
  topOffset = 56,
}: Props) {
  return (
    <View style={[styles.wrap, { top: topOffset }]} pointerEvents="box-none">
      <View style={[styles.card, variant === "success" && styles.cardSuccess]}>
        <Ionicons
          name={variant === "success" ? "checkmark-circle" : "people"}
          size={18}
          color={variant === "success" ? meetingTheme.success : meetingTheme.navy}
        />
        <Text style={styles.text}>{message}</Text>
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={8} accessibilityLabel="Dismiss">
            <Ionicons name="close" size={18} color={meetingTheme.textMuted} />
          </Pressable>
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
    zIndex: 28,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: meetingTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: meetingTheme.border,
    shadowColor: meetingTheme.pipShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardSuccess: {
    borderColor: "rgba(22, 163, 74, 0.35)",
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: meetingTheme.text,
    lineHeight: 18,
  },
});
