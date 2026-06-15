import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { haptics } from "../../../lib/haptics";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

type Props = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  disabled?: boolean;
};

export function PinPad({ value, onChange, maxLength = 6, disabled }: Props) {
  const c = useThemeColors();
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      dots: { flexDirection: "row", justifyContent: "center", gap: space.md, marginBottom: space.lg },
      dot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: palette.border,
      },
      dotFilled: { backgroundColor: palette.brandNavy, borderColor: palette.brandNavy },
      grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, justifyContent: "center" },
      key: {
        width: 72,
        height: 56,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: "center",
        justifyContent: "center",
      },
      keyPressed: { opacity: 0.75 },
      keyText: { ...typography.titleMd, color: palette.text, fontWeight: "600" },
    })
  );

  const press = (key: string) => {
    if (disabled) return;
    if (key === "") return;
    haptics.press();
    if (key === "del") {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= maxLength) return;
    onChange(value + key);
  };

  return (
    <View>
      <View style={styles.dots}>
        {Array.from({ length: maxLength }).map((_, i) => (
          <View key={i} style={[styles.dot, i < value.length && styles.dotFilled]} />
        ))}
      </View>
      <View style={styles.grid}>
        {KEYS.map((key, idx) => (
          <Pressable
            key={`${key}-${idx}`}
            style={({ pressed }) => [
              styles.key,
              !key && { backgroundColor: "transparent", borderWidth: 0 },
              pressed && key && styles.keyPressed,
            ]}
            onPress={() => press(key)}
            disabled={disabled || !key}
          >
            {key === "del" ? (
              <Ionicons name="backspace-outline" size={24} color={c.text} />
            ) : (
              !!key && <Text style={styles.keyText}>{key}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
