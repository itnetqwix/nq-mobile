import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";

export type ExtensionQuote = {
  allowed: boolean;
  reason?: string;
  amount: number;
  minutes: number;
  newEndTimeUtc?: string;
  remainingSeconds?: number | null;
};

/** Snapshot of the in-flight extension request shared between trainer and trainee. */
export type ExtensionRequestSnapshot = {
  requestId: string;
  status: "pending" | "accepted" | "rejected" | "paid" | "cancelled" | "expired";
  minutes: number;
  amount: number;
  requestedAt: string;
  expiresAt: string | null;
  requestedBy: string;
};

export async function fetchSessionExtensionQuote(
  sessionId: string,
  minutes: number
): Promise<ExtensionQuote> {
  const res = await apiClient.get(API_ROUTES.trainee.sessionExtensionQuote, {
    params: { sessionId, minutes },
  });
  const data = (res.data as { data?: ExtensionQuote })?.data ?? res.data;
  return data as ExtensionQuote;
}

/**
 * Trainee asks the trainer to extend. Server pauses the lesson timer and
 * broadcasts `SESSION_EXTENSION_REQUESTED` so the trainer's modal can open.
 * Returns `{ request, ...optionally a `liveRequest` reuse payload }`.
 */
export async function requestSessionExtension(payload: {
  sessionId: string;
  minutes: number;
}): Promise<{
  request?: ExtensionRequestSnapshot;
  allowed?: boolean;
  reason?: string;
}> {
  const res = await apiClient.post(
    API_ROUTES.trainee.sessionExtensionRequest,
    payload
  );
  return (res.data as { data?: unknown })?.data as {
    request?: ExtensionRequestSnapshot;
    allowed?: boolean;
    reason?: string;
  };
}

/**
 * Trainer accepts or rejects the trainee's pending request. On reject the
 * server resumes the timer; on accept it stays paused and the trainee gets
 * the green light to pay.
 */
export async function respondToExtensionRequest(payload: {
  sessionId: string;
  requestId: string;
  decision: "accept" | "reject";
}): Promise<{ request: ExtensionRequestSnapshot }> {
  const res = await apiClient.post(
    API_ROUTES.trainer.sessionExtensionRespond,
    payload
  );
  return (res.data as { data?: { request: ExtensionRequestSnapshot } })?.data as {
    request: ExtensionRequestSnapshot;
  };
}

/** Trainee aborts a pending/accepted request (e.g. payment sheet dismissed). */
export async function cancelExtensionRequest(payload: {
  sessionId: string;
  requestId: string;
  reason?: string;
}): Promise<{ request: ExtensionRequestSnapshot }> {
  const res = await apiClient.post(
    API_ROUTES.trainee.sessionExtensionCancel,
    payload
  );
  return (res.data as { data?: { request: ExtensionRequestSnapshot } })?.data as {
    request: ExtensionRequestSnapshot;
  };
}

export async function createSessionExtensionPaymentIntent(payload: {
  sessionId: string;
  minutes: number;
  requestId?: string;
  customer?: string;
  couponCode?: string;
}): Promise<{
  skip?: boolean;
  client_secret?: string;
  id?: string;
  amount?: number;
}> {
  const res = await apiClient.post(
    API_ROUTES.trainee.sessionExtensionPaymentIntent,
    payload
  );
  return ((res.data as { data?: unknown })?.data ?? res.data) as {
    skip?: boolean;
    client_secret?: string;
    id?: string;
    amount?: number;
  };
}

export async function confirmSessionExtension(payload: {
  sessionId: string;
  minutes: number;
  requestId?: string;
  payment_intent_id?: string | null;
  payment_method?: "wallet" | "card";
  pin_session_token?: string | null;
}): Promise<unknown> {
  const res = await apiClient.post(
    API_ROUTES.trainee.sessionExtensionConfirm,
    payload
  );
  return (res.data as { data?: unknown })?.data ?? res.data;
}
