/**
 * Screen-reader hook — returns `true` when VoiceOver / TalkBack is active.
 * Useful for swapping decorative-only visuals (e.g. presence dots) with
 * descriptive labels, or skipping auto-playing media when SR is on.
 */

import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useScreenReader(): boolean {
  const [on, setOn] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => {
        if (mounted) setOn(!!v);
      })
      .catch(() => undefined);

    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", (next) => {
      if (mounted) setOn(!!next);
    });
    return () => {
      mounted = false;
      if (sub && typeof (sub as { remove?: () => void }).remove === "function") {
        (sub as { remove: () => void }).remove();
      }
    };
  }, []);

  return on;
}
