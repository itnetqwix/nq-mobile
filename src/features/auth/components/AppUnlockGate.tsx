import React, { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { NetQwixLoader } from "../../../components/brand/NetQwixLoader";
import { requireAppUnlock } from "../security/appUnlock";

type Props = {
  children: React.ReactNode;
};

/** Re-prompt biometrics if the app was in background for more than this. */
const RELOCK_THRESHOLD_MS = 60 * 1000;

export function AppUnlockGate({ children }: Props) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await requireAppUnlock();
      if (cancelled) return;
      if (!ok) {
        setFailed(true);
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Foreground re-lock — keeps the app unlocked while the user is actively
   * using it but forces a fresh biometric prompt if it sat in the background
   * for longer than `RELOCK_THRESHOLD_MS`. Cheaper than re-prompting on every
   * resume (which would be annoying when checking a quick notification).
   */
  useEffect(() => {
    if (!ready) return;
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        backgroundedAt.current = Date.now();
        return;
      }
      if (next === "active") {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (since === null) return;
        if (Date.now() - since < RELOCK_THRESHOLD_MS) return;

        setReady(false);
        void (async () => {
          const ok = await requireAppUnlock();
          if (!ok) {
            setFailed(true);
            return;
          }
          setReady(true);
        })();
      }
    });
    return () => sub.remove();
  }, [ready]);

  if (failed) {
    return (
      <NetQwixLoader
        message="Unlock to continue"
        variant="fullscreen"
        motion="quick"
        backdrop="scrim"
        showTips
      />
    );
  }

  if (!ready) {
    return (
      <NetQwixLoader
        message="Unlocking…"
        variant="fullscreen"
        motion="quick"
        backdrop="scrim"
        showTips
      />
    );
  }

  return <>{children}</>;
}
