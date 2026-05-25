/**
 * Accessibility primitives — small, composable hooks/utilities used across the
 * app to honour OS-level a11y preferences.
 *
 *   import { useReduceMotion, useFontScale, clampFontScale } from "@/lib/a11y";
 *
 * Goals:
 *   • Respect Dynamic Type without breaking layouts (clamped scale).
 *   • Reduced-motion mode wraps expensive animations.
 *   • Listeners are torn down on unmount; SSR / non-RN fallbacks are safe.
 */

export { useReduceMotion } from "./useReduceMotion";
export { useFontScale, clampFontScale, scaleFont, FONT_SCALE_BOUNDS } from "./useFontScale";
export { useScreenReader } from "./useScreenReader";
