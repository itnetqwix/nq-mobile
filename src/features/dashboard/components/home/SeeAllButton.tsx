import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { space, typography, useThemeColors, useThemedStyles } from "../../../../theme";

type Props = {
  label: string;
  onPress: () => void;
};

export function SeeAllButton({ label, onPress }: Props) {
  const c = useThemeColors();
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      btn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: space.md,
        gap: 4,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
      },
      text: {
        ...typography.label,
        color: palette.brandNavy,
        fontWeight: "600",
      },
    })
  );

  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.text}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={c.brandNavy} />
    </Pressable>
  );
}
