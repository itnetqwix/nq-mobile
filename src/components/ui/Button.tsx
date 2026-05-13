/**
 * Button
 * ─────────────────────────────────────────────────────────────────────────────
 * The single button primitive used across every screen. Variants align with
 * the design system tokens — `primary` for the dominant CTA, `secondary` for
 * neutral confirmations, `ghost` for tertiary actions, `danger` for
 * destructive flows, and `link` for inline text affordances.
 *
 * Sizes: `sm` (36px), `md` (44px — accessibility floor), `lg` (52px).
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { colors, radii, space, typography } from "../../theme";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "link";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = Omit<PressableProps, "children"> & {
  label?: string;
  /** Legacy alias for `label`; kept so older screens keep compiling during
   *  the Phase 6c refactor sweep. */
  title?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  /** Full width by default — pass false to shrink to content. */
  fullWidth?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  title,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  leftIcon,
  rightIcon,
  fullWidth = true,
  style,
  ...rest
}: ButtonProps) {
  const text = label ?? title ?? "";
  const isDisabled = !!disabled || !!loading;
  const palette = getVariantPalette(variant);
  const sizing = SIZE_MAP[size];
  const labelColor = palette.text;

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed ? palette.bgPressed : palette.bg,
          borderColor: palette.border,
          borderWidth: palette.border === "transparent" ? 0 : 1,
          height: sizing.height,
          paddingHorizontal: sizing.padX,
          opacity: isDisabled ? 0.55 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? (
            <Ionicons
              name={leftIcon}
              size={sizing.iconSize}
              color={labelColor}
              style={{ marginRight: 6 }}
            />
          ) : null}
          <Text
            style={[
              typography.button,
              { color: labelColor, fontSize: sizing.fontSize },
            ]}
            numberOfLines={1}
          >
            {text}
          </Text>
          {rightIcon ? (
            <Ionicons
              name={rightIcon}
              size={sizing.iconSize}
              color={labelColor}
              style={{ marginLeft: 6 }}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

function getVariantPalette(variant: ButtonVariant) {
  switch (variant) {
    case "secondary":
      return {
        bg: colors.brandSubtle,
        bgPressed: "#cdd6ff",
        border: "transparent",
        text: colors.brand,
      };
    case "ghost":
      return {
        bg: "transparent",
        bgPressed: colors.surface,
        border: colors.border,
        text: colors.text,
      };
    case "danger":
      return {
        bg: colors.danger,
        bgPressed: "#b91c1c",
        border: "transparent",
        text: colors.dangerTextOn,
      };
    case "link":
      return {
        bg: "transparent",
        bgPressed: "transparent",
        border: "transparent",
        text: colors.brandAccent,
      };
    case "primary":
    default:
      return {
        bg: colors.brand,
        bgPressed: colors.brandPressed,
        border: "transparent",
        text: colors.brandTextOn,
      };
  }
}

const SIZE_MAP: Record<
  ButtonSize,
  { height: number; padX: number; fontSize: number; iconSize: number }
> = {
  sm: { height: 36, padX: space.md, fontSize: 13, iconSize: 16 },
  md: { height: 44, padX: space.md, fontSize: 15, iconSize: 18 },
  lg: { height: 52, padX: space.lg, fontSize: 16, iconSize: 20 },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
});
