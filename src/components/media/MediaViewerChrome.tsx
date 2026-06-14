import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { space, typography } from "../../theme";

type Props = {
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onOpenExternal?: () => void;
  rightSlot?: React.ReactNode;
  style?: ViewStyle;
};

/** Shared dark chrome for fullscreen media modals. */
export function MediaViewerChrome({
  title,
  subtitle,
  onClose,
  onOpenExternal,
  rightSlot,
  style,
}: Props) {
  return (
    <View style={[styles.bar, style]}>
      <Pressable
        onPress={onClose}
        style={styles.iconBtn}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Ionicons name="chevron-down" size={28} color="#fff" />
      </Pressable>

      <View style={styles.titleCol}>
        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightSlot ? (
        <View style={styles.rightSlot}>{rightSlot}</View>
      ) : null}
      {onOpenExternal ? (
        <Pressable
          onPress={onOpenExternal}
          style={styles.iconBtn}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Open in browser"
        >
          <Ionicons name="open-outline" size={22} color="#fff" />
        </Pressable>
      ) : !rightSlot ? (
        <View style={styles.iconSpacer} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    backgroundColor: "rgba(0,0,0,0.92)",
  },
  titleCol: { flex: 1, minWidth: 0 },
  title: { ...typography.titleSm, color: "#fff", fontWeight: "700" },
  subtitle: { ...typography.caption, color: "rgba(255,255,255,0.72)", marginTop: 2 },
  iconBtn: { padding: 4 },
  iconSpacer: { width: 30 },
  rightSlot: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: "auto" },
});
