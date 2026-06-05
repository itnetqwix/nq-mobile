/**
 * Responsive layout primitives — single source for window metrics,
 * breakpoints, and size scaling across phone sizes (SE → Pro Max → tablet).
 */

import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { space } from "../../theme";
import { useHorizontalGutter } from "./useHorizontalGutter";

/** Reference width (iPhone 14 / 15). */
export const LAYOUT_BASE_WIDTH = 390;

export const breakpoints = {
  compact: 0,
  regular: 360,
  large: 414,
  tablet: 768,
} as const;

export type Breakpoint = "compact" | "regular" | "large" | "tablet";

export function resolveBreakpoint(width: number): Breakpoint {
  if (width >= breakpoints.tablet) return "tablet";
  if (width >= breakpoints.large) return "large";
  if (width >= breakpoints.regular) return "regular";
  return "compact";
}

export type WindowMetrics = {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isCompact: boolean;
  isTablet: boolean;
};

/** Live window size + breakpoint — rotation-safe (unlike `Dimensions.get` at module scope). */
export function useWindowMetrics(): WindowMetrics {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const breakpoint = resolveBreakpoint(width);
    return {
      width,
      height,
      breakpoint,
      isCompact: breakpoint === "compact",
      isTablet: breakpoint === "tablet",
    };
  }, [width, height]);
}

/** Scale a fixed design size to the current window width. */
export function scaleSize(size: number, windowWidth: number, base = LAYOUT_BASE_WIDTH): number {
  const scaled = (size * windowWidth) / base;
  return Math.round(Math.max(size * 0.85, Math.min(size * 1.15, scaled)));
}

export function useScaleSize(size: number): number {
  const { width } = useWindowMetrics();
  return useMemo(() => scaleSize(size, width), [size, width]);
}

type SpaceKey = keyof typeof space;

/**
 * Usable content width inside horizontal gutter + safe area.
 * Use for carousel cards, hero banners, and full-bleed math.
 */
export function useContentWidth(gutter: SpaceKey = "md"): number {
  const { width } = useWindowMetrics();
  const pad = useHorizontalGutter(gutter);
  return useMemo(
    () => Math.max(0, width - pad.paddingLeft - pad.paddingRight),
    [width, pad.paddingLeft, pad.paddingRight]
  );
}

/** Fraction of content width (e.g. 0.72 for horizontal offer cards). */
export function useContentWidthFraction(fraction: number, gutter: SpaceKey = "md"): number {
  const contentWidth = useContentWidth(gutter);
  return useMemo(() => Math.round(contentWidth * fraction), [contentWidth, fraction]);
}

/** Responsive carousel card width with optional max cap. */
export function useCarouselCardWidth(opts?: {
  gutter?: SpaceKey;
  fraction?: number;
  maxWidth?: number;
}): number {
  const gutter = opts?.gutter ?? "md";
  const fraction = opts?.fraction ?? 1;
  const raw = useContentWidthFraction(fraction, gutter);
  const max = opts?.maxWidth;
  return useMemo(() => (max != null ? Math.min(raw, max) : raw), [raw, max]);
}
