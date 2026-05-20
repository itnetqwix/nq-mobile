/**
 * Persist notification action when the app cold-starts before context is ready.
 */

import * as SecureStore from "expo-secure-store";
import type { InstantLessonIncomingPayload } from "./instantLessonBridge";
import { INSTANT_LESSON_NOTIFICATION_ACTIONS } from "./instantLessonIncomingNotifications";

const PENDING_KEY = "nq.instantLesson.pendingNotificationAction";

type PendingAction = {
  action: (typeof INSTANT_LESSON_NOTIFICATION_ACTIONS)[keyof typeof INSTANT_LESSON_NOTIFICATION_ACTIONS];
  payload: InstantLessonIncomingPayload;
};

export async function stashInstantLessonNotificationAction(
  action: PendingAction["action"],
  payload: InstantLessonIncomingPayload
): Promise<void> {
  await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify({ action, payload }));
}

export async function consumeInstantLessonNotificationAction(): Promise<PendingAction | null> {
  const raw = await SecureStore.getItemAsync(PENDING_KEY);
  if (!raw) return null;
  await SecureStore.deleteItemAsync(PENDING_KEY);
  try {
    return JSON.parse(raw) as PendingAction;
  } catch {
    return null;
  }
}
