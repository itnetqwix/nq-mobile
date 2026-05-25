/**
 * Typography tokens
 * ─────────────────────────────────────────────────────────────────────────────
 * A small, intentional type scale. Sizes follow a 1.125 modular scale anchored
 * to 14px body so every screen feels like the same product.
 *
 * Usage (static — fine for chrome and dense layouts where sizes must stay
 * fixed to preserve grid):
 *   <Text style={typography.titleLg}>
 *   <Text style={[typography.bodyMd, { color: colors.textMuted }]}>
 *
 * Usage (Dynamic Type aware — preferred for body copy and headings):
 *   const text = useScaledTypography();
 *   <Text style={text.titleLg}>
 *
 * Static `typography` keeps every value as plain `TextStyle`. The hook
 * applies a clamped `PixelRatio.getFontScale()` (see {@link useFontScale})
 * so a user dialing up Dynamic Type sees text grow without spilling out of
 * cards or breaking icon-paired rows.
 */

import { Platform, PixelRatio, TextStyle } from "react-native";
import { clampFontScale, useFontScale } from "../lib/a11y/useFontScale";

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

function build(scale: number) {
  /**
   * `make` is captured per-scale so consumers always get pre-baked, ready-to-
   * spread `TextStyle` objects (no per-render math at the call site).
   */
  const mk = (
    fontSize: number,
    lineHeight: number,
    fontWeight: TextStyle["fontWeight"],
    letterSpacing = 0,
    family: string | undefined = FONT_REGULAR
  ): TextStyle => ({
    fontSize: Math.round(fontSize * scale),
    lineHeight: Math.round(lineHeight * scale),
    fontWeight,
    letterSpacing,
    fontFamily: family,
  });
  return {
    displayLg: mk(40, 48, "800", -0.5, FONT_BOLD),
    displayMd: mk(32, 40, "800", -0.4, FONT_BOLD),
    /**
     * `displaySm` — the smallest display tier, used for hero amounts
     * (wallet balance, earnings) where we want something punchier than
     * `titleLg` but lighter than `displayMd`. Inserted between the two
     * for a clean 32 / 28 / 24 step.
     */
    displaySm: mk(28, 36, "800", -0.3, FONT_BOLD),
    titleLg: mk(24, 32, "700", -0.2, FONT_BOLD),
    titleMd: mk(20, 28, "700", -0.1, FONT_BOLD),
    titleSm: mk(17, 24, "700", 0, FONT_BOLD),
    subtitle: mk(15, 22, "600", 0, FONT_MEDIUM),
    bodyLg: mk(16, 24, "400", 0, FONT_REGULAR),
    bodyMd: mk(14, 22, "400", 0, FONT_REGULAR),
    bodySm: mk(13, 20, "400", 0, FONT_REGULAR),
    /**
     * `body` — alias for `bodyMd`. Predates the explicit Md/Sm split and
     * is kept so historical call-sites (`ActiveSessionsScreen`, etc.)
     * keep compiling. New code should use `bodyMd` directly.
     */
    body: mk(14, 22, "400", 0, FONT_REGULAR),
    label: mk(13, 18, "600", 0.1, FONT_MEDIUM),
    overline: mk(11, 16, "700", 0.6, FONT_BOLD),
    caption: mk(12, 16, "400", 0, FONT_REGULAR),
    button: mk(15, 20, "700", 0.1, FONT_BOLD),
    monoNumber: mk(
      16,
      20,
      "700",
      1,
      Platform.select({ ios: "Menlo", android: "monospace", default: "Menlo" })
    ),
  } as const;
}

/**
 * Static typography — uses scale `1`. Imported at module scope by
 * `StyleSheet.create()` callers so it must not depend on hooks. Prefer the
 * `useScaledTypography()` hook for screen-level text.
 */
export const typography = build(1);

/**
 * Dynamic Type aware typography. Reads the (clamped) system font scale and
 * returns a fresh map of token → `TextStyle`. The hook re-renders when the
 * scale changes so the entire screen reflows.
 *
 *   const text = useScaledTypography();
 *   <Text style={text.titleLg}>{title}</Text>
 *
 * For one-off scaling of a specific size use {@link scaledFontSize}.
 */
export function useScaledTypography(): ReturnType<typeof build> {
  const scale = useFontScale();
  // The `build` call is cheap and returns a fresh object so React doesn't
  // memoise stale references when scale changes.
  return build(scale);
}

/** One-off scaling primitive — useful inside StyleSheet for fixed numeric sizes. */
export function scaledFontSize(px: number): number {
  return Math.round(px * clampFontScale(PixelRatio.getFontScale()));
}

export type TypographyToken = keyof typeof typography;
