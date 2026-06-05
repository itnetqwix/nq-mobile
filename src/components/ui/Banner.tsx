import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, space, typography, useThemeColors } from "../../theme";

export type BannerTone = "info" | "success" | "warning" | "danger";
export type BannerProps = {
  tone?: BannerTone;
  title: string;
  description?: string;
  onDismiss?: () => void;
  /** Action button next to the dismiss icon. */
  action?: { label: string; onPress: () => void };
};

/** Inline status banner — drop above a form or list when something needs the
 *  user's attention but shouldn't pop a modal. */
export function Banner({ tone = "info", title, description, onDismiss, action }: BannerProps) {
  const c = useThemeColors();
  const palette = getTonePalette(tone, c);
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: palette.bg, borderLeftColor: palette.accent },
      ]}
    >
      <Ionicons name={palette.icon} size={20} color={palette.accent} style={styles.icon} />
      <View style={styles.body}>
        <Text style={[typography.subtitle, { color: palette.text }]} numberOfLines={2}>
          {title}
        </Text>
        {description ? (
          <Text style={[typography.bodySm, { color: palette.text, marginTop: 2 }]}>
            {description}
          </Text>
        ) : null}
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8} style={styles.actionBtn}>
            <Text style={[typography.label, { color: palette.accent }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {onDismiss ? (
        <Pressable hitSlop={10} onPress={onDismiss} accessibilityLabel="Dismiss">
          <Ionicons name="close" size={18} color={palette.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

function getTonePalette(tone: BannerTone, c: ReturnType<typeof useThemeColors>) {
  switch (tone) {
    case "success":
      return {
        bg: c.successSubtle,
        accent: c.success,
        text: c.successText,
        icon: "checkmark-circle-outline" as const,
      };
    case "warning":
      return {
        bg: c.warningSubtle,
        accent: c.warning,
        text: c.warningText,
        icon: "alert-outline" as const,
      };
    case "danger":
      return {
        bg: c.dangerSubtle,
        accent: c.danger,
        text: c.dangerText,
        icon: "alert-circle-outline" as const,
      };
    case "info":
    default:
      return {
        bg: c.infoSubtle,
        accent: c.info,
        text: c.infoText,
        icon: "information-circle-outline" as const,
      };
  }
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    padding: space.md,
    borderLeftWidth: 4,
    borderRadius: radii.md,
    marginBottom: space.sm,
  },
  icon: { marginTop: 2 },
  body: { flex: 1 },
  actionBtn: { marginTop: space.sm, alignSelf: "flex-start" },
});
