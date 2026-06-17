import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme";

type Props = {
  onPress: () => void;
  color?: string;
  unreadCount?: number;
  accessibilityLabel: string;
};

/** Bell icon with optional unread dot for the locker / dashboard header. */
export function NotificationBellButton({
  onPress,
  color = colors.brandNavy,
  unreadCount = 0,
  accessibilityLabel,
}: Props) {
  const showDot = unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={styles.hit}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <Ionicons name="notifications-outline" size={24} color={color} />
      {showDot ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { padding: 4, position: "relative" },
  dot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surfaceElevated,
  },
});
