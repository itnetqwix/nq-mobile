/**
 * Dynamic Type / Android font scale support — clamped so a 1.8× system scale
 * doesn't push titles past container widths or break our 4/8-pt grid.
 *
 * Usage:
 *   const scale = useFontScale();          // 0.85 .. 1.35
 *   const title = useScaledTypography(typography.titleLg);
 *
 *   // One-off:
 *   <Text style={{ fontSize: scaleFont(16) }} />
 *
 * We never trust the raw OS scale; clamping keeps the UI legible and the
 * layout intact while still honouring the user's preference direction.
 */

import { useEffect, useState } from "react";
import { PixelRatio } from "react-native";

/** Lower bound prevents tiny illegible UI in a11y "shrink" modes;
 *  upper bound keeps multi-column layouts intact in extreme Dynamic Type. */
export const FONT_SCALE_BOUNDS = { min: 0.85, max: 1.35 } as const;

export function clampFontScale(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  if (raw < FONT_SCALE_BOUNDS.min) return FONT_SCALE_BOUNDS.min;
  if (raw > FONT_SCALE_BOUNDS.max) return FONT_SCALE_BOUNDS.max;
  return raw;
}

/** Convenience for one-off scaling outside hooks (no listener). */
export function scaleFont(px: number): number {
  return Math.round(px * clampFontScale(PixelRatio.getFontScale()));
}

/**
 * React hook that returns the current clamped font scale. Re-renders when the
 * user changes Dynamic Type while the app is open (iOS publishes a change
 * event; on Android we poll on focus). Falls back to 1 if unavailable.
 */
export function useFontScale(): number {
  const [scale, setScale] = useState(() => clampFontScale(PixelRatio.getFontScale()));

  useEffect(() => {
    /**
     * react-native exposes the font scale as a Dimensions metric. Subscribing
     * to "change" gives us the most reliable cross-platform signal — iOS
     * fires it for Dynamic Type and Android fires it for system font scale
     * changes (Settings → Display → Font size).
     */
    let unsub: (() => void) | null = null;
    void (async () => {
      try {
        const { Dimensions } = await import("react-native");
        const update = () => setScale(clampFontScale(PixelRatio.getFontScale()));
        const sub = Dimensions.addEventListener("change", update);
        unsub = () => {
          if (sub && typeof (sub as { remove?: () => void }).remove === "function") {
            (sub as { remove: () => void }).remove();
          }
        };
        update();
      } catch {
        /** Non-RN environments (tests, SSR) — keep static 1. */
      }
    })();
    return () => {
      if (unsub) unsub();
    };
  }, []);

  return scale;
}
