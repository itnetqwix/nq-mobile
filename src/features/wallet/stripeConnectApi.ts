import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { unwrapApiData } from "../../../lib/http/unwrapApiData";

export type StripeConnectStatus = {
  complete?: boolean;
  message?: string;
};

export async function fetchStripeConnectStatus(): Promise<StripeConnectStatus> {
  const res = await apiClient.get(API_ROUTES.user.checkStripeVerification);
  const data = unwrapApiData<{ message?: string }>(res);
  const msg = String(data?.message ?? "");
  return {
    complete: /completed successfully/i.test(msg) && !/not completed/i.test(msg),
    message: msg,
  };
}

export async function createStripeConnectOnboardingUrl(stripeAccountId: string): Promise<string> {
  const res = await apiClient.put(API_ROUTES.user.stripeAccountVerification, {
    stripe_account_id: stripeAccountId,
  });
  const data = unwrapApiData<{ url?: string; result?: { url?: string } }>(res);
  return String(data?.url ?? data?.result?.url ?? "");
}

export async function registerStripeAccount(stripeAccountId: string): Promise<void> {
  await apiClient.post(API_ROUTES.user.registerUserWithStripe, {
    stripe_account_id: stripeAccountId,
  });
}
