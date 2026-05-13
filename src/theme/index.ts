/**
 * Theme barrel — the only entry point screens/components should consume from.
 *
 *   import { colors, typography, shadows, durations, easings } from "@/theme";
 *
 * Backwards-compat:
 *   - `theme/tokens` re-exports from here so the in-progress migration to the
 *     new tokens doesn't require atomic touches across the app.
 */

import { useColorScheme } from "react-native";
import { type AppColors, colorsDark, colorsLight } from "./colors";

export { colorsDark, colorsLight, type AppColors } from "./colors";
export { typography, type TypographyToken } from "./typography";
export { shadows, type ShadowToken } from "./shadows";
export { durations, easings, type DurationToken, type EasingToken } from "./motion";

/**
 * Default (light) palette. Existing screens use this directly via
 * `import { colors } from "@/theme"` — once the dark-mode toggle ships
 * (Phase 6c), screens are migrated to `useThemeColors()` instead.
 */
export const colors = colorsLight;

/** Resolve light or dark — explicit form for non-hook callers. */
export function resolveColors(scheme: "light" | "dark" | null | undefined): AppColors {
  return scheme === "dark" ? colorsDark : colorsLight;
}

/** React hook variant — follows the system color scheme by default. Wire a
 *  manual override here once Settings exposes the toggle. */
export function useThemeColors(): AppColors {
  const scheme = useColorScheme();
  return resolveColors(scheme);
}

/** Spacing scale. Kept here so design tokens live next to each other. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Border radii. */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Layout primitives matching the website rails. */
export const layout = {
  drawerWidth: 300,
  sidebarRailCompact: 65,
  sidebarRailExpanded: 105,
  tabBarHeight: 64,
  minTapTarget: 44,
} as const;
