/**
 * Privacy & trust client — block-list, profile-visibility, data-export, 2FA.
 *
 * The endpoints here may not all be live on the backend yet; this module
 * mirrors the conventions used in `homeApi.ts` and consolidates the
 * payload shapes so screens stay declarative. When an endpoint is missing
 * the request will surface a `404` and the caller is expected to show a
 * "not available yet" alert — the UI degrades gracefully rather than
 * vanishing entirely.
 */

import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

export type BlockedUser = {
  _id: string;
  fullname?: string;
  fullName?: string;
  email?: string;
  profile_picture?: string;
  blocked_at?: string;
  reason?: string;
};

function unwrapList<T>(res: { data: unknown }): T[] {
  const body = res.data as { data?: unknown; result?: unknown } | undefined;
  const raw = body?.data ?? body?.result ?? (Array.isArray(res.data) ? res.data : null);
  return Array.isArray(raw) ? (raw as T[]) : [];
}

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const res = await apiClient.get(API_ROUTES.user.blockedUsers);
  return unwrapList<BlockedUser>(res);
}

export async function blockUserById(userId: string, reason?: string): Promise<void> {
  await apiClient.post(API_ROUTES.user.blockUser, { userId, reason });
}

export async function unblockUserById(userId: string): Promise<void> {
  /**
   * Send the userId in both body and query string — different backend
   * controllers accept different conventions and this keeps the client
   * forward-compatible.
   */
  await apiClient.post(
    `${API_ROUTES.user.unblockUser}?userId=${encodeURIComponent(userId)}`,
    { userId }
  );
}

/* ── Profile visibility ─────────────────────────────────────────────────── */

export type ProfileVisibility = {
  /** Show "Last active 2m ago" to others in chat + community lists. */
  show_last_active: boolean;
  /** Surface this profile to community search and trainer browse. */
  show_in_community_search: boolean;
  /** Accept DMs from people who aren't yet friends. */
  allow_message_requests_from_non_friends: boolean;
  /** Show online/presence dot to non-friends. */
  show_online_status: boolean;
};

export const DEFAULT_PROFILE_VISIBILITY: ProfileVisibility = {
  show_last_active: true,
  show_in_community_search: true,
  allow_message_requests_from_non_friends: true,
  show_online_status: true,
};

export function readProfileVisibility(user: Record<string, unknown> | null): ProfileVisibility {
  const raw = (user?.privacy_visibility ?? {}) as Partial<ProfileVisibility>;
  return {
    show_last_active: raw.show_last_active ?? DEFAULT_PROFILE_VISIBILITY.show_last_active,
    show_in_community_search:
      raw.show_in_community_search ?? DEFAULT_PROFILE_VISIBILITY.show_in_community_search,
    allow_message_requests_from_non_friends:
      raw.allow_message_requests_from_non_friends ??
      DEFAULT_PROFILE_VISIBILITY.allow_message_requests_from_non_friends,
    show_online_status: raw.show_online_status ?? DEFAULT_PROFILE_VISIBILITY.show_online_status,
  };
}

export async function updateProfileVisibility(
  patch: Partial<ProfileVisibility>
): Promise<ProfileVisibility> {
  const res = await apiClient.patch(API_ROUTES.user.updateProfileVisibility, patch);
  const body = (res.data as { data?: ProfileVisibility } | undefined)?.data;
  return body ?? { ...DEFAULT_PROFILE_VISIBILITY, ...patch };
}

/* ── Data export ────────────────────────────────────────────────────────── */

export type DataExportStatus = {
  state: "idle" | "queued" | "processing" | "ready" | "failed";
  requested_at?: string;
  ready_at?: string;
  expires_at?: string;
  download_url?: string;
  error?: string;
};

export async function requestDataExport(scope: "all" | "messages" | "bookings" = "all"): Promise<DataExportStatus> {
  const res = await apiClient.post(API_ROUTES.user.requestDataExport, { scope });
  const body = (res.data as { data?: DataExportStatus } | undefined)?.data;
  return body ?? { state: "queued", requested_at: new Date().toISOString() };
}

export async function fetchDataExportStatus(): Promise<DataExportStatus> {
  const res = await apiClient.get(API_ROUTES.user.dataExportStatus);
  const body = (res.data as { data?: DataExportStatus } | undefined)?.data;
  return body ?? { state: "idle" };
}

/* ── Two-factor (trainers) ──────────────────────────────────────────────── */

export type TwoFactorStatus = {
  enabled: boolean;
  /** Method currently active — initially email/SMS OTP. */
  method?: "email" | "sms" | "totp";
  /** Number of trusted devices the trainer can sign in from without OTP. */
  trustedDeviceCount?: number;
  /** Last successful 2FA event — surfaced as a reassurance string. */
  lastVerifiedAt?: string;
};

export async function fetchTwoFactorStatus(): Promise<TwoFactorStatus> {
  const res = await apiClient.get(API_ROUTES.user.twoFactorStatus);
  const body = (res.data as { data?: TwoFactorStatus } | undefined)?.data;
  return body ?? { enabled: false };
}

/** Request a one-time code via email / SMS to confirm enrolment. */
export async function requestTwoFactorChallenge(method: "email" | "sms"): Promise<{
  channel: "email" | "sms";
  target: string;
  expiresInSeconds: number;
}> {
  const res = await apiClient.post(API_ROUTES.user.twoFactorChallenge, { method });
  return (res.data as { data?: { channel: "email" | "sms"; target: string; expiresInSeconds: number } } | undefined)
    ?.data ?? {
    channel: method,
    target: "",
    expiresInSeconds: 300,
  };
}

export async function verifyTwoFactorChallenge(
  code: string,
  rememberDevice = true
): Promise<TwoFactorStatus> {
  const res = await apiClient.post(API_ROUTES.user.twoFactorVerify, { code, rememberDevice });
  const body = (res.data as { data?: TwoFactorStatus } | undefined)?.data;
  return body ?? { enabled: true, method: "email", lastVerifiedAt: new Date().toISOString() };
}

export async function enableTwoFactor(method: "email" | "sms"): Promise<TwoFactorStatus> {
  const res = await apiClient.post(API_ROUTES.user.twoFactorEnable, { method });
  const body = (res.data as { data?: TwoFactorStatus } | undefined)?.data;
  return body ?? { enabled: true, method };
}

export async function disableTwoFactor(): Promise<void> {
  await apiClient.post(API_ROUTES.user.twoFactorDisable, {});
}

export type TrustedDevice = {
  id: string;
  label: string;
  /** Last sign-in ISO timestamp from this device. */
  lastSeenAt?: string;
  /** Approximate location (IP geolocation). */
  location?: string;
  /** Marker for the device that's making the request. */
  current?: boolean;
};

export async function fetchTrustedDevices(): Promise<TrustedDevice[]> {
  const res = await apiClient.get(API_ROUTES.user.twoFactorTrustedDevices);
  return unwrapList<TrustedDevice>(res);
}

export async function revokeTrustedDevice(id: string): Promise<void> {
  await apiClient.delete(API_ROUTES.user.twoFactorRevokeTrustedDevice(id));
}
