import Constants from "expo-constants";
import { useEffect } from "react";
import { navigateToSystemState } from "../navigation/linkActions";

const MIN_VERSION = process.env.EXPO_PUBLIC_MIN_APP_VERSION?.trim();

function parseVersion(v: string): number[] {
  return v.split(".").map((n) => parseInt(n, 10) || 0);
}

function isBelowMin(current: string, minimum: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(minimum);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

/** Blocks the app when `EXPO_PUBLIC_MIN_APP_VERSION` is newer than the running build. */
export function useUpdateRequiredGate(enabled = true) {
  useEffect(() => {
    if (!enabled || !MIN_VERSION) return;
    const current =
      Constants.expoConfig?.version ??
      (Constants.manifest as { version?: string } | null)?.version ??
      "0.0.0";
    if (isBelowMin(current, MIN_VERSION)) {
      navigateToSystemState("update_required");
    }
  }, [enabled]);
}
