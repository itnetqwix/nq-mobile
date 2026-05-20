/**
 * High-priority incoming instant-lesson notifications (background / killed app).
 * Accept confirms the booking; trainer opens the app to join within the timer.
 */

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { colors } from "../../theme";
import type { InstantLessonIncomingPayload } from "./instantLessonBridge";

export const INSTANT_LESSON_CALL_CATEGORY = "INSTANT_LESSON_CALL";

export const INSTANT_LESSON_NOTIFICATION_ACTIONS = {
  ACCEPT: "INSTANT_LESSON_ACCEPT",
  DECLINE: "INSTANT_LESSON_DECLINE",
} as const;

const ACTIVE_INCOMING_IDS = new Set<string>();

export async function configureInstantLessonNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(INSTANT_LESSON_CALL_CATEGORY, [
    {
      identifier: INSTANT_LESSON_NOTIFICATION_ACTIONS.DECLINE,
      buttonTitle: "Decline",
      options: {
        isDestructive: true,
        opensAppToForeground: true,
      },
    },
    {
      identifier: INSTANT_LESSON_NOTIFICATION_ACTIONS.ACCEPT,
      buttonTitle: "Accept",
      options: {
        opensAppToForeground: true,
      },
    },
  ]);

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("instant_lesson_calls", {
      name: "Instant lesson calls",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400, 200, 600],
      lightColor: colors.brandNavy,
      sound: "instant_lesson_ring.wav",
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

export async function presentInstantLessonIncomingCall(
  payload: InstantLessonIncomingPayload
): Promise<void> {
  const traineeName = payload.traineeInfo?.fullname ?? "A trainee";
  const notificationId = `instant-incoming-${payload.lessonId}`;
  ACTIVE_INCOMING_IDS.add(notificationId);

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: notificationId,
      content: {
        title: "Instant lesson!",
        body: `${traineeName} wants a lesson now — tap ✓ to accept or ✕ to decline.`,
        categoryIdentifier: INSTANT_LESSON_CALL_CATEGORY,
        sound: "instant-lesson-ring.wav",
        ...(Platform.OS === "android"
          ? { channelId: "instant_lesson_calls" }
          : {}),
        priority: Notifications.AndroidNotificationPriority.MAX,
        sticky: true,
        autoDismiss: false,
        data: {
          kind: "instant_lesson_request",
          lessonId: payload.lessonId,
          coachId: payload.coachId,
          traineeId: payload.traineeId,
          traineeInfo: payload.traineeInfo,
          expiresAt: payload.expiresAt,
          duration: payload.duration,
          lessonType: payload.lessonType,
        },
      },
      trigger: null,
    });
  } catch {
    /* permissions or simulator */
  }
}

export async function dismissInstantLessonIncomingCall(lessonId: string): Promise<void> {
  const notificationId = `instant-incoming-${lessonId}`;
  ACTIVE_INCOMING_IDS.delete(notificationId);
  try {
    await Notifications.dismissNotificationAsync(notificationId);
  } catch {
    /* ignore */
  }
}

export async function dismissAllInstantLessonIncomingCalls(): Promise<void> {
  for (const id of [...ACTIVE_INCOMING_IDS]) {
    try {
      await Notifications.dismissNotificationAsync(id);
    } catch {
      /* ignore */
    }
  }
  ACTIVE_INCOMING_IDS.clear();
}

export function parseInstantLessonNotificationData(
  data: Record<string, unknown> | undefined
): InstantLessonIncomingPayload | null {
  if (!data || String(data.kind ?? "") !== "instant_lesson_request") return null;
  const lessonId = String(data.lessonId ?? "");
  if (!lessonId) return null;
  const traineeInfoRaw = data.traineeInfo as Record<string, unknown> | undefined;
  const expiresRaw = data.expiresAt;
  const expiresAt =
    typeof expiresRaw === "number"
      ? expiresRaw
      : expiresRaw
        ? new Date(String(expiresRaw)).getTime()
        : Date.now() + 60_000;
  return {
    lessonId,
    coachId: String(data.coachId ?? ""),
    traineeId: String(data.traineeId ?? ""),
    traineeInfo: {
      _id: String(traineeInfoRaw?._id ?? data.traineeId ?? ""),
      fullname: String(traineeInfoRaw?.fullname ?? "Trainee"),
      profile_picture: traineeInfoRaw?.profile_picture as string | undefined,
    },
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 60_000,
    duration: typeof data.duration === "number" ? data.duration : undefined,
    lessonType: typeof data.lessonType === "string" ? data.lessonType : undefined,
  };
}
