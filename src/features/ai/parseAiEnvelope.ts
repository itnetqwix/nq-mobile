/**
 * Unwrap `ResponseBuilder` JSON from AI routes (`result` payload).
 */
export function parseAiEnvelope<T extends Record<string, unknown>>(
  data: unknown
): T | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  if (root.status === "FAIL" || root.status === "fail") return null;

  const result = root.result;
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as T;
  }

  const nested = root.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as T;
  }

  return null;
}

export type ReviewAnalysisPayload = {
  overallSentiment?: string;
  strengths?: string[];
  improvements?: string[];
  summary?: string;
  reviewCount?: number;
  degraded?: boolean;
  cached?: boolean;
  insightVariant?: number;
  generatedAt?: string;
  nextRefreshAt?: string;
};

/** Match backend refresh window (3 days). */
export const REVIEW_INSIGHT_STALE_MS = 3 * 24 * 60 * 60 * 1000;
