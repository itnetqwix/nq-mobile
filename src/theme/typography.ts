/**
 * Typography tokens
 * ─────────────────────────────────────────────────────────────────────────────
 * A small, intentional type scale. Sizes follow a 1.125 modular scale anchored
 * to 14px body so every screen feels like the same product.
 *
 * Usage:
 *   <Text style={typography.titleLg}>
 *   <Text style={[typography.bodyMd, { color: colors.textMuted }]}>
 *
 * All values are plain objects compatible with React Native `TextStyle` so
 * they can be passed directly into `style` props or spread into `StyleSheet`.
 */

import { Platform, TextStyle } from "react-native";

/** Default font family — System on iOS (San Francisco), Roboto on Android.
 *  Use Inter when we add it via `expo-font`; the constants stay the same. */
const FONT_REGULAR = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "System",
});
const FONT_MEDIUM = Platform.select({
  ios: "System",
  android: "sans-serif-medium",
  default: "System",
});
const FONT_BOLD = Platform.select({
  ios: "System",
  android: "sans-serif-medium",
  default: "System",
});

const make = (
  fontSize: number,
  lineHeight: number,
  fontWeight: TextStyle["fontWeight"],
  letterSpacing = 0,
  family: string | undefined = FONT_REGULAR
): TextStyle => ({
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
  fontFamily: family,
});

export const typography = {
  /** Hero numbers + onboarding splashes. */
  displayLg: make(40, 48, "800", -0.5, FONT_BOLD),
  displayMd: make(32, 40, "800", -0.4, FONT_BOLD),

  /** Page titles, modal headers. */
  titleLg: make(24, 32, "700", -0.2, FONT_BOLD),
  titleMd: make(20, 28, "700", -0.1, FONT_BOLD),
  titleSm: make(17, 24, "700", 0, FONT_BOLD),

  /** Section labels — slightly tighter than body. */
  subtitle: make(15, 22, "600", 0, FONT_MEDIUM),

  /** Body copy. */
  bodyLg: make(16, 24, "400", 0, FONT_REGULAR),
  bodyMd: make(14, 22, "400", 0, FONT_REGULAR),
  bodySm: make(13, 20, "400", 0, FONT_REGULAR),

  /** UI affordances. */
  label: make(13, 18, "600", 0.1, FONT_MEDIUM),
  /** Uppercase row labels (Tools / Pages section headers). */
  overline: make(11, 16, "700", 0.6, FONT_BOLD),
  caption: make(12, 16, "400", 0, FONT_REGULAR),
  button: make(15, 20, "700", 0.1, FONT_BOLD),
  monoNumber: make(16, 20, "700", 1, Platform.select({ ios: "Menlo", android: "monospace", default: "Menlo" })),
} as const;

export type TypographyToken = keyof typeof typography;
