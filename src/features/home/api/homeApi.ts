import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

/**
 * `/user/all-online-user` returns `ResponseBuilder` JSON; `data` may be an aggregate row
 * `{ trainer_info: { _id, fullName, … } }` per `userService.getAllLatestOnlineUser`.
 * Normalize to flat trainer objects for UI (matches web `onlineUsers` usage).
 */
function normalizeOnlineTrainerRows(raw: unknown): any[] {
  const rows = Array.isArray(raw) ? raw : [];
  const out: any[] = [];
  for (const row of rows) {
    const t = (row as any)?.trainer_info ?? row;
    const id = t?._id ?? (row as any)?.trainer_id;
    if (!id) continue;
    out.push({
      _id: String(id),
      id: String(id),
      fullname: t.fullname ?? t.fullName,
      fullName: t.fullName ?? t.fullname,
      profile_picture: t.profile_picture,
      category: t.category,
      account_type: "Trainer",
    });
  }
  return out;
}

export async function fetchOnlineUsers(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.allOnlineUser);
  const body = res.data as Record<string, unknown>;
  const raw =
    body?.result ??
    body?.data ??
    (Array.isArray(body) ? body : null);
  if (Array.isArray(raw)) return normalizeOnlineTrainerRows(raw);
  if (raw && typeof raw === "object" && Array.isArray((raw as any).data)) {
    return normalizeOnlineTrainerRows((raw as any).data);
  }
  return [];
}

/** Backend returns `{ data: Session[], page, limit, hasMore, ... }` for scheduled-meetings. */
export async function fetchScheduledMeetings(status = "upcoming"): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.scheduledMeetings, {
    params: { status },
  });
  const body = res.data?.result ?? res.data;
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.data)) return body.data;
  return [];
}

export async function fetchFriendRequests(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.friendRequests);
  return res.data?.friendRequests ?? res.data ?? [];
}

export async function fetchRecentTrainees(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.trainer.getRecentTrainees);
  return res.data?.result ?? res.data ?? [];
}

export async function fetchRecentTrainers(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.trainee.recentTrainers);
  return res.data?.result ?? res.data ?? [];
}

export async function postAcceptFriendRequest(requestId: string): Promise<any> {
  const res = await apiClient.post(API_ROUTES.user.acceptFriendRequest, { requestId });
  return res.data;
}

export async function postRejectFriendRequest(requestId: string): Promise<any> {
  const res = await apiClient.post(API_ROUTES.user.rejectFriendRequest, { requestId });
  return res.data;
}

export async function fetchNotifications(page = 1, limit = 20): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.notifications.list, {
    params: { page, limit },
  });
  const body = res.data as Record<string, unknown>;
  /** Backend: `{ status, data: Notification[] }` — see `notificationsController.getNotifications`. */
  const list = body?.data ?? body?.result ?? body?.notifications;
  if (Array.isArray(list)) return list;
  return [];
}

/** Mark first page of unread inbox items read — same contract as web `PATCH /notifications/update` + `{ page }`. */
export async function patchNotificationsMarkRead(page = 1): Promise<void> {
  await apiClient.patch(API_ROUTES.notifications.update, { page });
}

/** Web `transaction.api.js` uses `GET /user/booking-list-by-id` for the transactions sidebar table. */
export async function fetchBookingTransactions(params?: {
  page?: number;
  limit?: number;
}): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.bookingListById, {
    params: { page: params?.page ?? 1, limit: params?.limit ?? 500 },
  });
  const inner = (res.data as any)?.data;
  const rows = inner?.result ?? inner?.data ?? res.data?.result;
  if (Array.isArray(rows)) return rows;
  return [];
}

export async function postInviteFriendEmail(userEmail: string): Promise<void> {
  await apiClient.post(API_ROUTES.user.inviteFriend, {
    user_email: userEmail.toLowerCase().trim(),
  });
}

export type UserNotificationPrefs = {
  promotional: { email: boolean; sms: boolean };
  transactional: { email: boolean; sms: boolean };
};

export async function patchUserNotificationSettings(
  notifications: UserNotificationPrefs
): Promise<void> {
  await apiClient.patch(API_ROUTES.user.updateNotificationsSettings, { notifications });
}

export async function postAccountPrivacy(isPrivate: boolean): Promise<void> {
  await apiClient.post(API_ROUTES.user.updateAccountPrivacy, { isPrivate });
}

export async function fetchTrainersWithSlots(params?: { search?: string }): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.trainee.getTrainersWithSlots, { params });
  const body = res.data as Record<string, unknown>;
  /** Backend: `{ status, data: Trainer[] }` — see `traineeController.getSlotsOfAllTrainers`. */
  const rows = body?.data ?? body?.result;
  if (Array.isArray(rows)) return rows;
  return [];
}

export async function fetchTrainerSlots(): Promise<
  { day: string; slots: { start_time?: string; end_time?: string }[] }[]
> {
  const res = await apiClient.get(API_ROUTES.trainer.getSlots);
  const root = (res.data as any)?.data ?? (res.data as any)?.result ?? res.data;
  const avail = root?.available_slots;
  if (Array.isArray(avail)) return avail;
  return [];
}

/** POST `/common/get-clips` — returns clips grouped by category (`_id` = category name). */
export async function postMyClipsGrouped(params?: {
  trainee_id?: string;
}): Promise<{ _id: string; clips: any[] }[]> {
  const res = await apiClient.post(API_ROUTES.common.getClips, params ?? {});
  const data = (res.data as any)?.data;
  return Array.isArray(data) ? data : [];
}

/** POST `/common/trainee-clips` — trainer: clips attached to bookings, grouped by trainee user. */
export async function postTraineeClipsGrouped(): Promise<{ _id: any; clips: any[] }[]> {
  const res = await apiClient.post(API_ROUTES.common.traineeClips, {});
  const data = (res.data as any)?.data;
  return Array.isArray(data) ? data : [];
}

export async function postGetAllSavedSessions(): Promise<any[]> {
  const res = await apiClient.post(API_ROUTES.common.getAllSavedSessions, {});
  const data = (res.data as any)?.data;
  return Array.isArray(data) ? data : [];
}

export async function postReportsGetAll(params?: { trainee_id?: string }): Promise<any[]> {
  const res = await apiClient.post(API_ROUTES.report.getAll, params ?? {});
  const d = res.data as Record<string, any>;
  if (Array.isArray(d?.result)) return d.result;
  if (Array.isArray(d?.data)) return d.data;
  return [];
}

/** Web `videoupload.api.js` → `POST /common/video-upload-url` (bulk clips + presigned PUT URLs). */
export type ClipUploadSignClip = {
  filename?: string;
  fileType: string;
  thumbnail: string;
  title: string;
  category: string;
};

export type ClipUploadSignPayload = {
  clips: ClipUploadSignClip[];
  shareOptions: {
    type: string;
    friends?: unknown;
    emails?: unknown;
  };
};

export type ClipUploadSignRow = {
  url: string;
  thumbnailURL: string;
};

export async function postClipUploadSignUrls(
  payload: ClipUploadSignPayload
): Promise<{ success?: number; results?: ClipUploadSignRow[]; message?: string }> {
  const res = await apiClient.post(API_ROUTES.common.videoUploadUrl, payload);
  return (res.data ?? {}) as { success?: number; results?: ClipUploadSignRow[]; message?: string };
}

export async function postShareClipsToEmail(userEmail: string, clips: any[]): Promise<void> {
  await apiClient.post(API_ROUTES.user.shareClips, {
    user_email: userEmail.trim().toLowerCase(),
    clips,
  });
}

export async function fetchFriends(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.friends);
  return res.data?.friends ?? res.data ?? [];
}

export async function fetchAllUsers(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.getAllUsers);
  return res.data?.result ?? res.data ?? [];
}
