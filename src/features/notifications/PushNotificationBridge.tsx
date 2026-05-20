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
 *   5. Handles instant-lesson Accept / Decline notification actions.
 */

import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { AppState } from "react-native";

import { useAuth } from "../auth/context/AuthContext";
import { navigationRef, navigateToNotifications } from "../../navigation/navigationRef";
import { presentNativeInstantLessonIncoming } from "../instant-lesson/InstantLessonCallKeepBridge";
import {
  configureInstantLessonNotificationCategories,
  dismissInstantLessonIncomingCall,
  parseInstantLessonNotificationData,
  INSTANT_LESSON_NOTIFICATION_ACTIONS,
  presentInstantLessonIncomingCall,
} from "../instant-lesson/instantLessonIncomingNotifications";
import {
  emitInstantLessonIncomingRequest,
  getInstantLessonActionHandlers,
} from "../instant-lesson/instantLessonBridge";
import { stashInstantLessonNotificationAction } from "../instant-lesson/instantLessonPendingAction";
import {
  configureAndroidChannels,
  registerDevicePushToken,
  unregisterDevicePushToken,
} from "./pushTokens";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as Record<string, unknown> | undefined;
    const isInstantCall = String(data?.kind ?? "") === "instant_lesson_request";
    return {
      shouldShowAlert: true,
      shouldPlaySound: !isInstantCall,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

async function handleInstantLessonNotificationAction(
  actionId: string,
  data: Record<string, unknown>
): Promise<void> {
  const payload = parseInstantLessonNotificationData(data);
  if (!payload) return;

  const handlers = getInstantLessonActionHandlers();

  if (actionId === INSTANT_LESSON_NOTIFICATION_ACTIONS.ACCEPT) {
    if (handlers.acceptIncoming) {
      await handlers.acceptIncoming(payload);
    } else {
      await stashInstantLessonNotificationAction(
        INSTANT_LESSON_NOTIFICATION_ACTIONS.ACCEPT,
        payload
      );
    }
    await dismissInstantLessonIncomingCall(payload.lessonId);
    return;
  }

  if (actionId === INSTANT_LESSON_NOTIFICATION_ACTIONS.DECLINE) {
    if (handlers.declineIncoming) {
      await handlers.declineIncoming(payload.lessonId);
    } else {
      await stashInstantLessonNotificationAction(
        INSTANT_LESSON_NOTIFICATION_ACTIONS.DECLINE,
        payload
      );
    }
    await dismissInstantLessonIncomingCall(payload.lessonId);
  }
}

export function PushNotificationBridge() {
  const { status } = useAuth();

  useEffect(() => {
    void configureAndroidChannels();
    void configureInstantLessonNotificationCategories();
  }, []);

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

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      const payload = parseInstantLessonNotificationData(data);
      if (!payload) return;
      emitInstantLessonIncomingRequest(payload);
      void (async () => {
        const nativeShown = await presentNativeInstantLessonIncoming(payload);
        if (!nativeShown && AppState.currentState !== "active") {
          void presentInstantLessonIncomingCall(payload);
        }
      })();
    });

    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const content = event.notification.request.content;
      const data = (content.data ?? {}) as Record<string, unknown>;
      const actionId = event.actionIdentifier;

      if (
        actionId === INSTANT_LESSON_NOTIFICATION_ACTIONS.ACCEPT ||
        actionId === INSTANT_LESSON_NOTIFICATION_ACTIONS.DECLINE
      ) {
        void handleInstantLessonNotificationAction(actionId, data);
        return;
      }

      if (Notifications.DEFAULT_ACTION_IDENTIFIER === actionId) {
        const payload = parseInstantLessonNotificationData(data);
        if (payload) {
          emitInstantLessonIncomingRequest(payload);
        }
      }

      const title = String(content.title ?? "");
      handlePushTap(title, data);
    });

    return () => {
      received.remove();
      response.remove();
    };
  }, []);

  return null;
}

function handlePushTap(title: string, data: Record<string, unknown>) {
  const kind = String(data.kind ?? "").toLowerCase();
  const lessonId =
    (data.lessonId as string) ??
    (data.bookingId as string) ??
    (data.booking_id as string) ??
    null;

  if (kind === "instant_lesson_request") {
    const payload = parseInstantLessonNotificationData(data);
    if (payload) {
      emitInstantLessonIncomingRequest(payload);
    }
    if (navigationRef.isReady()) {
      (navigationRef as any).navigate("Main", {
        screen: "Tabs",
        params: {
          screen: "Schedule",
        },
      });
    }
    return;
  }

  if (
    kind === "meeting" ||
    kind === "instant_lesson_accept" ||
    kind === "instant_lesson_accepted" ||
    kind === "instant_lesson_join_reminder" ||
    (data.isInstant && data.outcome === "accepted")
  ) {
    if (lessonId && navigationRef.isReady()) {
      (navigationRef as any).navigate("Meeting", { lessonId });
      return;
    }
  }

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
          screen: "Schedule",
        },
      });
      return;
    }
  }

  navigateToNotifications();
}
