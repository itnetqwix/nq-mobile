import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Centralized haptic feedback for the app.
 *
 * Conventions (tuned for a calm, WhatsApp-style feel — not a casino):
 *   • `tap`        → very light tick for routine taps (tab switch, list row,
 *                    filter chip, message bubble).
 *   • `select`     → subtle "selection" tick for picker-style choices
 *                    (toggles inside a sheet, segmented controls).
 *   • `press`      → a touch firmer than `tap` for primary actions
 *                    (send a message, confirm a sheet).
 *   • `impact`     → medium thump for important events (start/stop
 *                    recording, opening an attachment sheet).
 *   • `success`    → notification haptic for completion (message delivered,
 *                    group created, action saved).
 *   • `warning`    → notification haptic for soft warnings (limit reached,
 *                    permission denied).
 *   • `error`      → notification haptic for hard failures (send failed,
 *                    destructive confirm).
 *
 * Every helper is fire-and-forget: callers do not need to await. All errors
 * (e.g. on simulators) are silently swallowed so haptics can never break a
 * user flow.
 */

let enabled = true;

/** Globally turn haptics on/off — call from a Settings screen if needed. */
export function setHapticsEnabled(value: boolean) {
  enabled = !!value;
}

export function areHapticsEnabled(): boolean {
  return enabled;
}

function fire(fn: () => Promise<unknown>): void {
  if (!enabled) return;
  // Web and some embedded platforms don't implement the native module.
  if (Platform.OS === "web") return;
  try {
    void fn().catch(() => {
      /* swallowed */
    });
  } catch {
    /* swallowed */
  }
}

export const haptics = {
  tap(): void {
    fire(() => Haptics.selectionAsync());
  },
  select(): void {
    fire(() => Haptics.selectionAsync());
  },
  press(): void {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  impact(): void {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  heavy(): void {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },
  success(): void {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warning(): void {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  error(): void {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
};
