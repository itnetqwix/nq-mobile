import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

/**
 * Phase 2 (item 15) — OTP-gated, two-step account deletion with a 15-day
 * support-restore window. The legacy `requestAccountDeletion()` is kept
 * for backwards compatibility but should not be called by new code.
 */

export type LifecycleState = {
  deleted: boolean;
  hibernated: boolean;
  hibernatedAt?: string | null;
  hibernatedReason?: string | null;
  pendingDeletion: boolean;
  pendingDeletionAt?: string | null;
  restoreDeadline?: string | null;
};

export async function getLifecycleState(): Promise<LifecycleState> {
  const res = await apiClient.get(API_ROUTES.user.lifecycle);
  const body = res.data?.data ?? res.data ?? {};

  return {
    deleted: !!body.deleted,
    hibernated: !!body.hibernated,
    hibernatedAt: body.hibernatedAt ?? null,
    hibernatedReason: body.hibernatedReason ?? null,
    pendingDeletion: !!body.pendingDeletion,
    pendingDeletionAt: body.pendingDeletionAt ?? null,
    restoreDeadline: body.restoreDeadline ?? null,
  };
}

export type DeletionOtpStartResult = {
  channel: "email" | "sms";
  target: string;
  expiresInSeconds: number;
};

export async function startAccountDeletion(input: {
  password: string;
  reason?: string;
  feedback_category?: string;
  channel?: "email" | "sms";
}): Promise<DeletionOtpStartResult> {
  const res = await apiClient.post(API_ROUTES.user.deletionRequest, input);
  const body = res.data?.data ?? res.data ?? {};

  return body.otp ?? body;
}

export async function confirmAccountDeletionOtp(input: {
  code: string;
  reason?: string;
}): Promise<{ restoreDeadline: string; restoreWindowDays: number }> {
  const res = await apiClient.post(API_ROUTES.user.deletionConfirm, input);
  const body = res.data?.data ?? res.data ?? {};

  return {
    restoreDeadline: body.restoreDeadline,
    restoreWindowDays: body.restoreWindowDays ?? 15,
  };
}

export async function cancelPendingDeletion(): Promise<void> {
  await apiClient.post(API_ROUTES.user.deletionCancel, {});
}

export async function startHibernate(channel?: "email" | "sms"): Promise<DeletionOtpStartResult> {
  const res = await apiClient.post(API_ROUTES.user.hibernateRequest, {
    channel: channel ?? "email",
  });
  const body = res.data?.data ?? res.data ?? {};

  return body.otp ?? body;
}

export async function confirmHibernateOtp(input: {
  code: string;
  reason?: string;
}): Promise<void> {
  await apiClient.post(API_ROUTES.user.hibernateConfirm, input);
}

/**
 * Legacy one-shot deletion (kept so older call sites still compile; new
 * code should call the OTP-gated `startAccountDeletion` /
 * `confirmAccountDeletionOtp` pair instead).
 */
export async function requestAccountDeletion(reason?: string): Promise<void> {
  await apiClient.delete(API_ROUTES.user.deleteMe, {
    data: reason ? { reason } : undefined,
  });
}
