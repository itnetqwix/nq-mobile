import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

export type TraineeNote = {
  _id?: string;
  trainer_id: string;
  trainee_id: string;
  text: string;
  tags: string[];
  updatedAt?: string;
};

export async function fetchTraineeNote(
  traineeId: string
): Promise<TraineeNote | null> {
  const { data } = await apiClient.get(API_ROUTES.trainer.traineeNote(traineeId));
  const inner =
    (data as { data?: { note?: TraineeNote } })?.data?.note ??
    (data as { result?: { note?: TraineeNote } })?.result?.note ??
    null;
  return inner ?? null;
}

export async function saveTraineeNote(
  traineeId: string,
  payload: { text: string; tags?: string[] }
): Promise<TraineeNote> {
  const { data } = await apiClient.put(
    API_ROUTES.trainer.traineeNote(traineeId),
    { text: payload.text, tags: payload.tags ?? [] }
  );
  const inner =
    (data as { data?: { note?: TraineeNote } })?.data?.note ??
    (data as { result?: { note?: TraineeNote } })?.result?.note;
  if (!inner) throw new Error("Could not save note.");
  return inner;
}

export async function deleteTraineeNote(traineeId: string): Promise<void> {
  await apiClient.delete(API_ROUTES.trainer.traineeNote(traineeId));
}

export type NudgeCandidate = {
  trainee_id: string;
  fullname?: string;
  profile_picture?: string;
  last_session?: string;
  days_since: number;
  total_sessions: number;
};

export async function fetchNudgeCandidates(): Promise<NudgeCandidate[]> {
  const { data } = await apiClient.get(API_ROUTES.trainer.nudgeCandidates);
  const inner =
    (data as { data?: { candidates?: NudgeCandidate[] } })?.data?.candidates ??
    (data as { result?: { candidates?: NudgeCandidate[] } })?.result?.candidates ??
    [];
  return Array.isArray(inner) ? inner : [];
}

export type NudgeTemplate = "comeback" | "checkin" | "promo";

export async function sendSessionRecap(payload: {
  sessionId?: string;
  traineeId?: string;
  summary?: string;
  drills?: string;
  homework?: string;
}): Promise<{ sent: boolean; message: string }> {
  const { data } = await apiClient.post(API_ROUTES.trainer.sessionRecap, payload);
  const inner =
    (data as { data?: { sent?: boolean; message?: string } })?.data ??
    (data as { result?: { sent?: boolean; message?: string } })?.result ??
    {};
  return {
    sent: Boolean((inner as { sent?: boolean }).sent),
    message: String((inner as { message?: string }).message ?? ""),
  };
}

export async function sendTraineeNudge(payload: {
  traineeId: string;
  template?: NudgeTemplate;
  message?: string;
}): Promise<{ sent: boolean; message: string }> {
  const { data } = await apiClient.post(API_ROUTES.trainer.traineeNudge, {
    traineeId: payload.traineeId,
    template: payload.template ?? "comeback",
    message: payload.message,
  });
  const inner =
    (data as { data?: { sent?: boolean; message?: string } })?.data ??
    (data as { result?: { sent?: boolean; message?: string } })?.result ??
    {};
  return {
    sent: Boolean((inner as { sent?: boolean }).sent),
    message: String((inner as { message?: string }).message ?? ""),
  };
}
