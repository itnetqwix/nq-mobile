import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import {
  parseAiEnvelope,
  type ReviewAnalysisPayload,
} from "./parseAiEnvelope";

export async function fetchReviewAnalysis(): Promise<ReviewAnalysisPayload> {
  const res = await apiClient.get(API_ROUTES.ai.reviewAnalysis, {
    _skipAuthSignOut: true,
  });
  const parsed = parseAiEnvelope<ReviewAnalysisPayload>(res.data);
  if (!parsed) {
    throw new Error("Review analysis unavailable.");
  }
  return parsed;
}
