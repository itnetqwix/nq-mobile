/**
 * Motion tokens
 * ─────────────────────────────────────────────────────────────────────────────
 * Durations + easings for `Animated` / `Reanimated`. Keep them small — the
 * point is consistency, not variety. Match Material/iOS conventions:
 *
 *   • fast    (120ms) — micro-interactions (button press, ripple).
 *   • base    (200ms) — modals open/close, list reorder.
 *   • slow    (320ms) — full-screen transitions, hero animations.
 *
 * Easings (`Animated.Easing` constants live in the consumer because the
 * Animated API is React-only). We expose the names; callers map them.
 */

import { Easing, EasingFunction } from "react-native";

export const durations = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

export const easings: Record<
  "standard" | "decelerate" | "accelerate" | "sharp",
  EasingFunction
> = {
  /** "Material standard" — symmetrical, the safe default. */
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  /** Element entering. */
  decelerate: Easing.bezier(0, 0, 0.2, 1),
  /** Element leaving. */
  accelerate: Easing.bezier(0.4, 0, 1, 1),
  /** Snappy responses. */
  sharp: Easing.bezier(0.4, 0, 0.6, 1),
};

export type DurationToken = keyof typeof durations;
export type EasingToken = keyof typeof easings;
