/**
 * Card — primary content surface. Three variants:
 *   • flat (no shadow, useful inside grouped lists)
 *   • raised (default — soft shadow)
 *   • outlined (border, no shadow, great for dense forms)
 */

import React from "react";
import { Pressable, type PressableProps, StyleSheet, View, type ViewStyle } from "react-native";
import { radii, shadows, space, useThemeColors } from "../../theme";

export type CardVariant = "flat" | "raised" | "outlined";

type CommonProps = {
  variant?: CardVariant;
  padding?: keyof typeof space | 0;
  style?: ViewStyle;
  children?: React.ReactNode;
};

type Props =
  | (CommonProps & { onPress?: undefined })
  | (CommonProps & Pick<PressableProps, "onPress" | "accessibilityLabel" | "accessibilityRole">);

export function Card({
  variant = "raised",
  padding = "md",
  style,
  children,
  ...rest
}: Props) {
  const c = useThemeColors();
  const padValue = padding === 0 ? 0 : space[padding];
  const wrapStyle: ViewStyle = {
    backgroundColor: c.surfaceElevated,
    borderRadius: radii.md,
    padding: padValue,
    ...(variant === "raised" ? shadows.md : null),
    ...(variant === "outlined"
      ? { borderWidth: 1, borderColor: c.border }
      : null),
  };

  if ("onPress" in rest && rest.onPress) {
    return (
      <Pressable
        {...rest}
        style={({ pressed }) => [wrapStyle, pressed && { opacity: 0.92 }, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[wrapStyle, style]}>{children}</View>;
}

export const cardStyles = StyleSheet.create({
  /** Helper for compact list rows that nest inside a Card. */
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
