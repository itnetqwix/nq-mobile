/**
 * Reduced-Motion hook — wraps `AccessibilityInfo.isReduceMotionEnabled()` and
 * subscribes to changes so screens can skip non-essential animations.
 *
 * Usage:
 *   const reduceMotion = useReduceMotion();
 *   <Animated.View style={reduceMotion ? null : pulseStyle} />
 *
 * The hook is hot-path safe — it has a small synchronous cache so the first
 * render after mount returns the last known value (instead of always
 * starting at `false` and flickering animations on).
 */

import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

let cached: boolean = false;
let initialised = false;

void (async () => {
  try {
    const initial = await AccessibilityInfo.isReduceMotionEnabled();
    cached = !!initial;
    initialised = true;
  } catch {
    /** Older RN platforms — assume motion is allowed. */
    cached = false;
    initialised = true;
  }
})();

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState<boolean>(cached);

  useEffect(() => {
    let mounted = true;
    if (!initialised) {
      void AccessibilityInfo.isReduceMotionEnabled()
        .then((v) => {
          cached = !!v;
          if (mounted) setReduce(cached);
        })
        .catch(() => undefined);
    } else if (cached !== reduce) {
      setReduce(cached);
    }

    /** Listen for live changes (e.g. user toggles in Settings while app open). */
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (next) => {
      cached = !!next;
      if (mounted) setReduce(cached);
    });

    return () => {
      mounted = false;
      if (sub && typeof (sub as { remove?: () => void }).remove === "function") {
        (sub as { remove: () => void }).remove();
      }
    };
  }, [reduce]);

  return reduce;
}
