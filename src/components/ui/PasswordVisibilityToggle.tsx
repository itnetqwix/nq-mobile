import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable } from "react-native";
import { useThemeColors } from "../../theme";

type Props = {
  visible: boolean;
  onToggle: () => void;
};

export function PasswordVisibilityToggle({ visible, onToggle }: Props) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={visible ? "Hide password" : "Show password"}
    >
      <Ionicons
        name={visible ? "eye-off-outline" : "eye-outline"}
        size={22}
        color={c.textMuted}
      />
    </Pressable>
  );
}
