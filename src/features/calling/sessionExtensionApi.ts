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

export async function createSessionExtensionPaymentIntent(payload: {
  sessionId: string;
  minutes: number;
  customer?: string;
  couponCode?: string;
}): Promise<{
  skip?: boolean;
  client_secret?: string;
  id?: string;
  amount?: number;
}> {
  const res = await apiClient.post(API_ROUTES.trainee.sessionExtensionPaymentIntent, payload);
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
  payment_intent_id?: string | null;
}): Promise<unknown> {
  const res = await apiClient.post(API_ROUTES.trainee.sessionExtensionConfirm, payload);
  return (res.data as { data?: unknown })?.data ?? res.data;
}
