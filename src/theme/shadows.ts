/**
 * Shadow tokens
 * ─────────────────────────────────────────────────────────────────────────────
 * Cross-platform elevation presets. Android picks `elevation`, iOS picks the
 * shadow* triplet — same name, identical visual weight.
 *
 * Usage:
 *   const c = useThemeColors();
 *   <View style={[styles.card, themedShadow("md", c)]}>
 */

import { Platform, ViewStyle } from "react-native";
const shadow = (
  color: string,
  opacity: number,
  radius: number,
  offsetY: number,
  elevation: number
): ViewStyle =>
  Platform.select({
    ios: {
      shadowColor: color,
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: {
      elevation,
      shadowColor: color,
    },
    default: {},
  }) as ViewStyle;

const LIGHT_SHADOW_COLOR = "#0f172a";
const DARK_SHADOW_COLOR = "#000000";

function buildShadows(isDark: boolean) {
  const color = isDark ? DARK_SHADOW_COLOR : LIGHT_SHADOW_COLOR;
  const boost = isDark ? 1.35 : 1;
  return {
    none: {} as ViewStyle,
    sm: shadow(color, 0.08 * boost, 4, 1, isDark ? 3 : 2),
    md: shadow(color, 0.12 * boost, 8, 4, isDark ? 6 : 4),
    lg: shadow(color, 0.18 * boost, 16, 6, isDark ? 10 : 8),
    xl: shadow(color, 0.24 * boost, 24, 12, isDark ? 14 : 12),
  } as const;
}

/** Static light-theme shadows — module-scope StyleSheet only. */
export const shadows = buildShadows(false);

export type ShadowToken = keyof typeof shadows;

/** Runtime shadows that read better on dark elevated surfaces. */
export function themedShadow(token: ShadowToken, isDark: boolean): ViewStyle {
  return buildShadows(isDark)[token];
}
