import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { space, useThemeColors, useThemedStyles } from "../../../theme";
import type { SystemStatePreset } from "../presets/types";

type Props = {
  icon?: SystemStatePreset["icon"];
  variant?: SystemStatePreset["variant"];
};

export function SystemStateHero({ icon = "alert-circle-outline", variant = "default" }: Props) {
  const c = useThemeColors();
  const styles = useThemedStyles((palette) => {
    const halo =
      variant === "success"
        ? palette.successSubtle ?? palette.brandAccentSubtle
        : variant === "danger"
          ? palette.dangerSubtle ?? "#FEE2E2"
          : variant === "warning"
            ? "#FEF3C7"
            : palette.brandAccentSubtle;
    const iconColor =
      variant === "success"
        ? palette.success ?? "#16A34A"
        : variant === "danger"
          ? palette.danger
          : variant === "warning"
            ? "#D97706"
            : palette.brandAccent;
    return StyleSheet.create({
      halo: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: halo,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: space.lg,
      },
    });
  });

  const iconColor =
    variant === "success"
      ? (c as any).success ?? "#16A34A"
      : variant === "danger"
        ? c.danger
        : variant === "warning"
          ? "#D97706"
          : c.brandAccent;

  return (
    <View style={styles.halo}>
      <Ionicons name={icon} size={44} color={iconColor} />
    </View>
  );
}
