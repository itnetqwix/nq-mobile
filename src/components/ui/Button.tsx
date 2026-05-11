import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { colors, radii, space } from "../../theme/tokens";

type Props = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: "primary" | "ghost";
};

export function Button({ title, loading, variant = "primary", disabled, style, ...rest }: Props) {
  const isGhost = variant === "ghost";
  return (
    <Pressable
      accessibilityRole="button"
      style={(state) => {
        const extra = typeof style === "function" ? style(state) : style;
        return [
          styles.base,
          isGhost ? styles.ghost : styles.primary,
          (disabled || loading) && styles.disabled,
          state.pressed && !disabled && !loading && styles.pressed,
          extra,
        ];
      }}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? colors.primary : "#fff"} />
      ) : (
        <Text style={[styles.title, isGhost && styles.titleGhost]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.9,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  titleGhost: {
    color: colors.primary,
  },
});
