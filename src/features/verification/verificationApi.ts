import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";

export type OnboardingStatus = {
  required: boolean;
  step: string | null;
  status: string;
  email_verified: boolean;
  phone_verified: boolean;
  email_masked?: string | null;
  phone_masked?: string | null;
  contact_substep?: "email" | "phone" | "complete";
  in_grace_period?: boolean;
  grace_days_remaining?: number;
  grace_deadline?: string;
  rejection_reason?: string;
};

export async function getVerificationStatus(): Promise<OnboardingStatus> {
  const res = await apiClient.get(API_ROUTES.verification.status);
  return res.data?.data ?? res.data;
}

export async function sendVerificationOtp(channel: "email" | "sms") {
  const res = await apiClient.post(API_ROUTES.verification.otpSend, { channel });
  return res.data?.data ?? res.data;
}

export async function verifyVerificationOtp(channel: "email" | "sms", code: string) {
  const res = await apiClient.post(API_ROUTES.verification.otpVerify, { channel, code });
  return res.data?.data ?? res.data;
}

export async function updateVerificationProfile(body: Record<string, unknown>) {
  const res = await apiClient.put(API_ROUTES.verification.profile, body);
  return res.data?.data ?? res.data;
}

export async function createFaceLivenessSession() {
  const res = await apiClient.post(API_ROUTES.verification.faceSession);
  return res.data?.data ?? res.data;
}

export async function completeFaceLiveness(sessionId?: string) {
  const res = await apiClient.post(API_ROUTES.verification.faceComplete, { sessionId });
  return res.data?.data ?? res.data;
}

/** Fallback when `/verification/status` is unavailable — mirrors backend rules. */
export function needsTrainerOnboarding(
  user: {
    account_type?: string;
    status?: string;
    trainer_verification?: Record<string, unknown>;
    /**
     * Optional onboarding metadata. The backend started returning this
     * field once we shipped the new trainer wizard, but older clients +
     * the legacy user shape don't include it. Declare it explicitly so
     * call-sites (e.g. session bootstrap) keep typechecking.
     */
    onboarding?: { required?: boolean } | null;
  } | null
): boolean {
  if (!user || user.account_type !== "Trainer") return false;

  const onboarding = user.onboarding ?? undefined;
  if (typeof onboarding?.required === "boolean") return onboarding.required;

  const tv = (user.trainer_verification || {}) as Record<string, unknown>;
  const grace = tv.grace_deadline ? new Date(String(tv.grace_deadline)) : null;
  if (grace && Date.now() < grace.getTime()) return false;

  const step = String(tv.onboarding_step || "account_created");
  const submitted = Boolean(tv.submitted_for_review_at);
  if (user.status === "approved" && !submitted && step === "account_created") {
    return false;
  }

  return step !== "completed" || user.status !== "approved";
}
