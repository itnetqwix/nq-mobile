import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { extractLoginTokens } from "../../../lib/http/parseLoginResponse";

export type MagicLinkRequestResult = {
  sent: boolean;
  expires_in_minutes: number;
};

export async function postMagicLinkRequest(
  email: string
): Promise<MagicLinkRequestResult> {
  const { data } = await apiClient.post(API_ROUTES.auth.magicLinkRequest, {
    email: email.trim().toLowerCase(),
  });
  const result = (data as { data?: MagicLinkRequestResult; result?: { data?: MagicLinkRequestResult } })
    .data ?? (data as { result?: { data?: MagicLinkRequestResult } }).result?.data;
  return {
    sent: result?.sent ?? true,
    expires_in_minutes: result?.expires_in_minutes ?? 15,
  };
}

export type MagicLinkVerifyTokens = {
  access_token: string;
  refresh_token?: string;
  session_id?: string;
  account_type: string;
};

export async function postMagicLinkVerify(payload: {
  email: string;
  code?: string;
  token?: string;
}): Promise<MagicLinkVerifyTokens> {
  const { data } = await apiClient.post(API_ROUTES.auth.magicLinkVerify, {
    email: payload.email.trim().toLowerCase(),
    code: payload.code,
    token: payload.token,
  });
  const tokens = extractLoginTokens(data);
  if (!tokens?.access_token) {
    throw new Error("Could not sign you in. Try requesting a fresh code.");
  }
  return tokens;
}
