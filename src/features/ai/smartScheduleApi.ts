import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { parseAiEnvelope } from "./parseAiEnvelope";

export type SmartScheduleSuggestion = {
  day: string;
  time: string;
  reason: string;
};

export type SmartSchedulePayload = {
  suggestions: SmartScheduleSuggestion[];
};

export async function fetchSmartSchedule(
  trainerId: string
): Promise<SmartSchedulePayload> {
  const res = await apiClient.get(API_ROUTES.ai.smartSchedule(trainerId));
  const parsed = parseAiEnvelope<SmartSchedulePayload>(res.data);
  return parsed ?? { suggestions: [] };
}
