/**
 * PushNotificationBridge
 * ─────────────────────────────────────────────────────────────────────────────
 * Single mount point for everything `expo-notifications` related:
 *
 *   1. Sets the global handler (alert/badge/sound + suppress in meeting).
 *   2. On sign-in, registers the device push token with the backend.
 *   3. On sign-out, unregisters it.
 *   4. Routes notification taps to the correct deep link (meeting / inbox /
 *      booking) via the shared `navigationRef`.
 *
 * Mount it inside `AuthProvider` so it can read auth state, but outside the
 * NavigationContainer is fine — the ref is global.
 */

import { useEffect } from "react";
import * as Notifications from "expo-notifications";

import { useAuth } from "../auth/context/AuthContext";
import { navigationRef, navigateToNotifications } from "../../navigation/navigationRef";
import {
  configureAndroidChannels,
  registerDevicePushToken,
  unregisterDevicePushToken,
} from "./pushTokens";

/** Global handler — controls whether the OS displays an alert when a push
 *  arrives while the app is foregrounded. We always show alerts; the in-app
 *  toast still fires in parallel so the user gets the rich UI either way. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function PushNotificationBridge() {
  const { status } = useAuth();

  /** One-time channel setup. */
  useEffect(() => {
    void configureAndroidChannels();
  }, []);

  /** Register/unregister the device token whenever auth flips. */
  useEffect(() => {
    let cancelled = false;
    if (status === "signedIn") {
      (async () => {
        const result = await registerDevicePushToken();
        if (cancelled || !result) return;
      })();
    } else if (status === "signedOut") {
      void unregisterDevicePushToken();
    }
    return () => {
      cancelled = true;
    };
  }, [status]);

  /** Deep-link routing on tap. We look at the notification payload's
   *  `data.kind` field if the backend supplies one, otherwise fall back to a
   *  best-effort title-based router. */
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      const title = String(response.notification.request.content.title ?? "");
      handlePushTap(title, data as Record<string, unknown>);
    });
    return () => sub.remove();
  }, []);

  return null;
}

function handlePushTap(title: string, data: Record<string, unknown>) {
  const kind = String(data.kind ?? "").toLowerCase();
  const lessonId = (data.lessonId as string) ?? (data.booking_id as string) ?? null;

  /** Meeting deep link — primary action when a confirmed lesson is ready. */
  if (kind === "meeting" || (data.isInstant && data.outcome === "accepted")) {
    if (lessonId && navigationRef.isReady()) {
      (navigationRef as any).navigate("Meeting", { lessonId });
      return;
    }
  }

  /** Booking-related → upcoming sessions. */
  const lower = title.toLowerCase();
  if (
    lower.includes("book") ||
    lower.includes("session") ||
    lower.includes("confirm") ||
    lessonId
  ) {
    if (navigationRef.isReady()) {
      (navigationRef as any).navigate("Main", {
        screen: "Tabs",
        params: {
          screen: "Menu",
          params: {
            screen: "DashboardFeature",
            params: { featureId: "upcoming-sessions" },
          },
        },
      });
      return;
    }
  }

  /** Default: open the inbox. */
  navigateToNotifications();
}
