/**
 * Shadow tokens
 * ─────────────────────────────────────────────────────────────────────────────
 * Cross-platform elevation presets. Android picks `elevation`, iOS picks the
 * shadow* triplet — same name, identical visual weight.
 *
 * Usage:
 *   <View style={[styles.card, shadows.md]}>
 */

import { Platform, ViewStyle } from "react-native";

const shadow = (
  opacity: number,
  radius: number,
  offsetY: number,
  elevation: number
): ViewStyle =>
  Platform.select({
    ios: {
      shadowColor: "#0f172a",
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: {
      elevation,
      /** Android shadows are tinted by the surface — keep elevation as the
       *  primary driver; shadowColor on Android is best-effort. */
      shadowColor: "#0f172a",
    },
    default: {},
  }) as ViewStyle;

export const shadows = {
  none: {} as ViewStyle,
  sm: shadow(0.08, 4, 1, 2),
  md: shadow(0.12, 8, 4, 4),
  lg: shadow(0.18, 16, 6, 8),
  xl: shadow(0.24, 24, 12, 12),
} as const;

export type ShadowToken = keyof typeof shadows;
