/**
 * Compact-device guardrails when Dynamic Type is elevated — prevents
 * headline overflow on iPhone SE / mini widths.
 */

import { useMemo } from "react";
import { useFontScale } from "../a11y/useFontScale";
import { useWindowMetrics } from "./responsive";

export type CompactA11yGuard = {
  isCompact: boolean;
  fontScale: number;
  /** Tighten horizontal padding on small screens with large text. */
  tightenHorizontal: boolean;
  /** Prefer single-line titles with ellipsis on compact + scaled text. */
  preferSingleLineTitles: boolean;
};

export function useCompactA11yGuard(): CompactA11yGuard {
  const { isCompact } = useWindowMetrics();
  const fontScale = useFontScale();
  return useMemo(() => {
    const scaledUp = fontScale > 1.05;
    return {
      isCompact,
      fontScale,
      tightenHorizontal: isCompact && scaledUp,
      preferSingleLineTitles: isCompact || fontScale > 1.2,
    };
  }, [isCompact, fontScale]);
}
