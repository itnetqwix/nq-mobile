/**
 * Per-device call preferences (background blur, default mic/camera).
 *
 * Persisted in AsyncStorage so a trainer who turns blur ON during a
 * lesson keeps it ON for the next one. We expose a tiny pub/sub store
 * instead of context to keep the import boundary thin — the meeting
 * surface, the action button, and the pre-call lobby all subscribe.
 *
 * NOTE on background blur:
 *   True frame-level blur requires a native frame processor (e.g.
 *   `react-native-vision-camera` + ML Kit). Until that lands, the
 *   preference still has user-visible feedback: the local PIP renders
 *   a subtle scrim + "Blur ON" pill so the user can verify their
 *   choice is being honoured, and the toggle persists.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const BLUR_PREF_KEY = "@netqwix:precall.blurEnabled";

type Listener = (snapshot: CallPreferences) => void;

export type CallPreferences = {
  blurEnabled: boolean;
};

let snapshot: CallPreferences = { blurEnabled: false };
const listeners = new Set<Listener>();
let hydrated = false;

function emit() {
  for (const l of listeners) {
    try {
      l(snapshot);
    } catch {
      /* listener errors must never break the meeting surface */
    }
  }
}

export async function hydrateCallPreferences(): Promise<CallPreferences> {
  if (hydrated) return snapshot;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(BLUR_PREF_KEY);
    snapshot = { ...snapshot, blurEnabled: raw === "1" };
  } catch {
    /* defaults are fine */
  }
  emit();
  return snapshot;
}

export function getCallPreferences(): CallPreferences {
  return snapshot;
}

export async function setBackgroundBlurEnabled(enabled: boolean): Promise<void> {
  snapshot = { ...snapshot, blurEnabled: enabled };
  emit();
  try {
    await AsyncStorage.setItem(BLUR_PREF_KEY, enabled ? "1" : "0");
  } catch {
    /* persist is best-effort; runtime preference still applies */
  }
}

export function subscribeCallPreferences(listener: Listener): () => void {
  listeners.add(listener);
  // Emit current value immediately so subscribers don't need to read
  // separately.
  try {
    listener(snapshot);
  } catch {
    /* ignore — see emit() */
  }
  return () => {
    listeners.delete(listener);
  };
}
