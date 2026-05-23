import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { radii, typography, useThemeColors, useThemedStyles } from "../../../../theme";

type IonName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  icon: IonName;
  label: string;
  value: string;
  onPress?: () => void;
  tone?: "default" | "success" | "warning";
  accessibilityLabel?: string;
  /** Fill equal width in a row (e.g. earnings snapshot). */
  expand?: boolean;
};

export function DashboardStatChip({
  icon,
  label,
  value,
  onPress,
  tone = "default",
  accessibilityLabel,
  expand,
}: Props) {
  const c = useThemeColors();
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        maxWidth: expand ? undefined : 160,
        flex: expand ? 1 : undefined,
        minWidth: expand ? 0 : undefined,
      },
      chipSuccess: { borderColor: palette.success, backgroundColor: `${palette.success}12` },
      chipWarning: { borderColor: palette.warning, backgroundColor: `${palette.warning}12` },
      textCol: { flexShrink: 1 },
      label: { ...typography.caption, color: palette.textMuted, fontSize: 10 },
      value: { ...typography.caption, color: palette.text, fontWeight: "700" },
    })
  );

  const iconColor =
    tone === "success" ? c.success : tone === "warning" ? c.warning : c.brandNavy;

  const inner = (
    <>
      <Ionicons name={icon} size={16} color={iconColor} />
      <View style={styles.textCol}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[
          styles.chip,
          tone === "success" && styles.chipSuccess,
          tone === "warning" && styles.chipWarning,
        ]}
      >
        {inner}
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        tone === "success" && styles.chipSuccess,
        tone === "warning" && styles.chipWarning,
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
    >
      {inner}
    </Pressable>
  );
}
