import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { unwrapApiData } from "../../lib/http/unwrapApiData";
import { parseStripeConnectMessage, type StripeConnectStatus } from "./stripeConnectLogic";

export type { StripeConnectStatus };

export async function fetchStripeConnectStatus(): Promise<StripeConnectStatus> {
  const res = await apiClient.get(API_ROUTES.user.checkStripeVerification);
  const envelope = unwrapApiData<{
    msg?: string;
    message?: string;
    result?: { message?: string };
  }>(res);
  const msg = String(
    envelope?.result?.message ?? envelope?.msg ?? envelope?.message ?? ""
  );
  return parseStripeConnectMessage(msg);
}

export async function createStripeConnectOnboardingUrl(stripeAccountId: string): Promise<string> {
  const res = await apiClient.put(API_ROUTES.user.stripeAccountVerification, {
    stripe_account_id: stripeAccountId,
  });
  const envelope = unwrapApiData<{
    url?: string;
    result?: { url?: string };
  }>(res);
  return String(envelope?.result?.url ?? envelope?.url ?? "");
}

export async function registerStripeAccount(stripeAccountId: string): Promise<void> {
  await apiClient.post(API_ROUTES.user.registerUserWithStripe, {
    stripe_account_id: stripeAccountId,
  });
}
