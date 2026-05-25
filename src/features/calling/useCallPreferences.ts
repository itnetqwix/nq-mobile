import { useEffect, useState } from "react";
import {
  getCallPreferences,
  hydrateCallPreferences,
  setBackgroundBlurEnabled,
  subscribeCallPreferences,
  type CallPreferences,
} from "./callPreferences";

/**
 * React binding for the call preferences pub/sub. Triggers a hydration
 * read on first use so the toggle picks up its persisted value even on
 * cold starts.
 */
export function useCallPreferences(): {
  blurEnabled: boolean;
  setBlurEnabled: (enabled: boolean) => Promise<void>;
} {
  const [snap, setSnap] = useState<CallPreferences>(getCallPreferences());

  useEffect(() => {
    let cancelled = false;
    void hydrateCallPreferences().then((value) => {
      if (!cancelled) setSnap(value);
    });
    const unsubscribe = subscribeCallPreferences((next) => {
      if (!cancelled) setSnap(next);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return {
    blurEnabled: snap.blurEnabled,
    setBlurEnabled: setBackgroundBlurEnabled,
  };
}
