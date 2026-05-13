import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, space, typography } from "../../theme";

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
  const palette = getTonePalette(tone);
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

function getTonePalette(tone: BannerTone) {
  switch (tone) {
    case "success":
      return {
        bg: colors.successSubtle,
        accent: colors.success,
        text: colors.successText,
        icon: "checkmark-circle-outline" as const,
      };
    case "warning":
      return {
        bg: colors.warningSubtle,
        accent: colors.warning,
        text: colors.warningText,
        icon: "alert-outline" as const,
      };
    case "danger":
      return {
        bg: colors.dangerSubtle,
        accent: colors.danger,
        text: colors.dangerText,
        icon: "alert-circle-outline" as const,
      };
    case "info":
    default:
      return {
        bg: colors.infoSubtle,
        accent: colors.info,
        text: colors.infoText,
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
    borderRadius: radii.md,
    borderLeftWidth: 3,
  },
  icon: { marginTop: 2 },
  body: { flex: 1 },
  actionBtn: { marginTop: space.xs, alignSelf: "flex-start" },
});
