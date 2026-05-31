import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { idempotencyHeaders, stableIdempotencyKey } from "../../lib/idempotency";

export type InstantLessonAcceptResult = {
  acceptedAt: string;
  joinDeadlineAt: string;
  phase: string;
};

export async function acceptInstantLessonRest(payload: {
  lessonId: string;
  traineeId: string;
}): Promise<InstantLessonAcceptResult> {
  const res = await apiClient.post(
    API_ROUTES.trainer.instantLessonAccept,
    payload,
    {
      headers: idempotencyHeaders(
        stableIdempotencyKey("instant-accept", payload.lessonId)
      ),
    }
  );
  const raw = res.data as {
    data?: InstantLessonAcceptResult & { ok?: boolean };
  };
  const body = raw?.data;
  if (!body?.acceptedAt || !body?.joinDeadlineAt) {
    throw new Error("Invalid accept response from server.");
  }
  return {
    acceptedAt: body.acceptedAt,
    joinDeadlineAt: body.joinDeadlineAt,
    phase: body.phase ?? "pending_join",
  };
}

export async function declineInstantLessonRest(payload: {
  lessonId: string;
  traineeId: string;
}): Promise<void> {
  await apiClient.post(API_ROUTES.trainer.instantLessonDecline, payload, {
    headers: idempotencyHeaders(
      stableIdempotencyKey("instant-decline", payload.lessonId)
    ),
  });
}
