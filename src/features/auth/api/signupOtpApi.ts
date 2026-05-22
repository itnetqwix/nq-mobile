import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

export type SignupContactCheck = {
  available: boolean;
  normalized?: string;
  message?: string;
};

export async function checkSignupContact(
  channel: "email" | "sms",
  destination: { email?: string; mobile_no?: string }
): Promise<SignupContactCheck> {
  const body =
    channel === "email"
      ? { channel, email: destination.email?.trim().toLowerCase() }
      : { channel, mobile_no: destination.mobile_no?.trim() };
  const res = await apiClient.post(API_ROUTES.auth.signupCheckContact, body);
  const data = res.data?.data ?? res.data;
  return {
    available: Boolean(data?.available),
    normalized: data?.normalized,
    message: data?.message,
  };
}

export async function sendSignupOtp(
  channel: "email" | "sms",
  destination: { email?: string; mobile_no?: string }
) {
  const body =
    channel === "email"
      ? { channel, email: destination.email?.trim().toLowerCase() }
      : { channel, mobile_no: destination.mobile_no?.trim() };
  const res = await apiClient.post(API_ROUTES.auth.signupOtpSend, body);
  return res.data?.data ?? res.data;
}

export async function verifySignupOtp(
  channel: "email" | "sms",
  destination: { email?: string; mobile_no?: string },
  code: string
) {
  const body =
    channel === "email"
      ? { channel, email: destination.email?.trim().toLowerCase(), code: code.trim() }
      : { channel, mobile_no: destination.mobile_no?.trim(), code: code.trim() };
  const res = await apiClient.post(API_ROUTES.auth.signupOtpVerify, body);
  return res.data?.data ?? res.data;
}
