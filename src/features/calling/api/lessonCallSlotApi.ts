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

function parseLessonCallSlotPayload(raw: unknown): LessonCallSlotStatus {
  const body = raw as Record<string, unknown>;
  const payload =
    body?.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : body;
  return {
    canJoin: payload.canJoin !== false,
    canTakeOver: Boolean(payload.canTakeOver),
    reason: typeof payload.reason === "string" ? payload.reason : undefined,
    stale: Boolean(payload.stale),
    activeElsewhere: Boolean(payload.activeElsewhere),
  };
}

/** Pre-join check — avoids entering the meeting when another device holds the slot. */
export async function fetchLessonCallSlotStatus(
  sessionId: string
): Promise<LessonCallSlotStatus> {
  const res = await apiClient.get(API_ROUTES.chat.lessonCallSlot(sessionId));
  return parseLessonCallSlotPayload(res.data);
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
