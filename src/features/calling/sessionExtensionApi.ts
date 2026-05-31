import type { AxiosRequestConfig } from "axios";
import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import {
  idempotencyHeaders,
  stableIdempotencyKey,
} from "../../lib/idempotency";

import type { PricingQuote } from "../payments/pricingTypes";

export type ExtensionQuote = {
  allowed: boolean;
  reason?: string;
  amount: number;
  minutes: number;
  newEndTimeUtc?: string;
  remainingSeconds?: number | null;
  pricingQuote?: PricingQuote | null;
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

const IDEMPOTENCY_RETRY_MS = 500;
const IDEMPOTENCY_MAX_ATTEMPTS = 3;

function isIdempotencyConflict(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  const msg = String(
    (err as { response?: { data?: { error?: string; message?: string } } })?.response
      ?.data?.error ??
      (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ??
      ""
  ).toLowerCase();
  return (
    status === 409 &&
    (msg.includes("processing") ||
      msg.includes("idempotency") ||
      msg.includes("confirmation already"))
  );
}

async function postWithIdempotencyRetry<T>(
  url: string,
  data: unknown,
  config: AxiosRequestConfig
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < IDEMPOTENCY_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await apiClient.post(url, data, config);
      return ((res.data as { data?: T })?.data ?? res.data) as T;
    } catch (e) {
      lastErr = e;
      if (!isIdempotencyConflict(e) || attempt === IDEMPOTENCY_MAX_ATTEMPTS - 1) {
        throw e;
      }
      await new Promise((r) =>
        setTimeout(r, IDEMPOTENCY_RETRY_MS * (attempt + 1))
      );
    }
  }
  throw lastErr;
}

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
  return postWithIdempotencyRetry(
    API_ROUTES.trainee.sessionExtensionRequest,
    payload,
    {
      headers: idempotencyHeaders(
        stableIdempotencyKey(
          "ext-req",
          payload.sessionId,
          payload.minutes
        )
      ),
    }
  );
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
  return postWithIdempotencyRetry(
    API_ROUTES.trainer.sessionExtensionRespond,
    payload,
    {
      headers: idempotencyHeaders(
        stableIdempotencyKey(
          "ext-respond",
          payload.sessionId,
          payload.requestId,
          payload.decision
        )
      ),
    }
  );
}

/** Trainee aborts a pending/accepted request (e.g. payment sheet dismissed). */
export async function cancelExtensionRequest(payload: {
  sessionId: string;
  requestId: string;
  reason?: string;
}): Promise<{ request: ExtensionRequestSnapshot }> {
  return postWithIdempotencyRetry(
    API_ROUTES.trainee.sessionExtensionCancel,
    payload,
    {
      headers: idempotencyHeaders(
        stableIdempotencyKey(
          "ext-cancel",
          payload.sessionId,
          payload.requestId
        )
      ),
    }
  );
}

export async function createSessionExtensionPaymentIntent(payload: {
  sessionId: string;
  minutes: number;
  requestId?: string;
  customer?: string;
  couponCode?: string;
  quoteId?: string;
  billingAddress?: { country: string; state?: string };
}): Promise<{
  skip?: boolean;
  client_secret?: string;
  id?: string;
  amount?: number;
}> {
  const idemKey = payload.requestId
    ? stableIdempotencyKey("ext-pi", payload.sessionId, payload.requestId)
    : stableIdempotencyKey("ext-pi", payload.sessionId, payload.minutes);
  return postWithIdempotencyRetry(
    API_ROUTES.trainee.sessionExtensionPaymentIntent,
    payload,
    { headers: idempotencyHeaders(idemKey) }
  );
}

export async function confirmSessionExtension(payload: {
  sessionId: string;
  minutes: number;
  requestId?: string;
  payment_intent_id?: string | null;
  payment_method?: "wallet" | "card";
  pin_session_token?: string | null;
  quoteId?: string;
}): Promise<unknown> {
  const idemKey = payload.payment_intent_id
    ? stableIdempotencyKey(
        "ext-confirm",
        payload.sessionId,
        payload.payment_intent_id
      )
    : payload.requestId
      ? stableIdempotencyKey(
          "ext-confirm",
          payload.sessionId,
          payload.requestId
        )
      : stableIdempotencyKey(
          "ext-confirm",
          payload.sessionId,
          payload.minutes
        );
  return postWithIdempotencyRetry(
    API_ROUTES.trainee.sessionExtensionConfirm,
    payload,
    { headers: idempotencyHeaders(idemKey) }
  );
}
