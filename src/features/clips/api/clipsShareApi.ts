import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import type { LockerClip } from "./clipsApi";

export type ClipShareRequestRow = {
  _id: string;
  from_user_id: string;
  to_user_id: string;
  clip_ids: string[];
  status: string;
  message?: string;
  expires_at?: string;
  createdAt?: string;
  sharer?: {
    _id?: string;
    fullname?: string;
    profile_picture?: string;
    account_type?: string;
  };
  recipient?: { _id?: string; fullname?: string; email?: string };
  clips?: LockerClip[];
};

function unwrap<T>(res: { data?: unknown }): T {
  const body = res.data as Record<string, unknown>;
  if (body && typeof body === "object" && "status" in body && body.status === "FAIL") {
    throw new Error(String(body.error ?? body.message ?? "Request failed"));
  }
  return (body ?? {}) as T;
}

export async function postClipShareRequests(params: {
  clipIds: string[];
  friendIds: string[];
  message?: string;
}): Promise<{
  deliveredByFriend?: Record<string, string[]>;
  skipped?: { friendId: string; reason: string }[];
  message?: string;
}> {
  const res = await apiClient.post(API_ROUTES.clips.shareRequests, params);
  return unwrap(res);
}

export async function fetchClipShareInbox(): Promise<ClipShareRequestRow[]> {
  const res = await apiClient.get(API_ROUTES.clips.shareInbox);
  const data = unwrap<ClipShareRequestRow[] | { data?: ClipShareRequestRow[] }>(res);
  if (Array.isArray(data)) return data;
  return Array.isArray((data as any)?.data) ? (data as any).data : [];
}

export async function respondClipShareRequest(
  requestId: string,
  action: "accept" | "decline"
): Promise<{ status?: string; deliveredCount?: number }> {
  try {
    const res = await apiClient.post(API_ROUTES.clips.shareRespond(requestId), { action });
    return unwrap(res);
  } catch (e) {
    throw new Error(getApiErrorMessage(e, "Could not respond to share request."));
  }
}

export async function cancelClipShareRequest(requestId: string): Promise<void> {
  await apiClient.post(API_ROUTES.clips.shareCancel(requestId), {});
}
