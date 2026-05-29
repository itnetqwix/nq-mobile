import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

export type LessonCallSlotStatus = {
  success?: number;
  canJoin: boolean;
  reason?: string;
  stale?: boolean;
  activeElsewhere?: boolean;
  canTakeOver?: boolean;
};

/** Pre-join check — avoids entering the meeting when another device holds the slot. */
export async function fetchLessonCallSlotStatus(
  sessionId: string
): Promise<LessonCallSlotStatus> {
  const res = await apiClient.get(API_ROUTES.chat.lessonCallSlot(sessionId));
  const body = (res as { data?: LessonCallSlotStatus })?.data ?? res;
  return body as LessonCallSlotStatus;
}

/** Clear the active-device lock so this client can enter the meeting. */
export async function postLessonCallSlotTakeover(
  sessionId: string
): Promise<{ success?: number; tookOver?: boolean }> {
  const res = await apiClient.post(
    API_ROUTES.chat.lessonCallSlotTakeover(sessionId)
  );
  const body = (res as { data?: Record<string, unknown> })?.data ?? res;
  return body as { success?: number; tookOver?: boolean };
}
