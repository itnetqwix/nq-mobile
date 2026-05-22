import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { space, typography, useThemeColors, useThemedStyles } from "../../../../theme";

type IonName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  title: string;
  subtitle?: string;
  icon?: IonName;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function DashboardPressableRow({
  title,
  subtitle,
  icon,
  onPress,
  accessibilityLabel,
}: Props) {
  const c = useThemeColors();
  const styles = useStyles();

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {icon ? <Ionicons name={icon} size={22} color={c.brandNavy} /> : null}
      <View style={styles.textCol}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
    </Pressable>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: space.sm,
      },
      textCol: { flex: 1, minWidth: 0 },
      title: { ...typography.subtitle, color: palette.text, fontWeight: "600" },
      sub: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
    })
  );
}
