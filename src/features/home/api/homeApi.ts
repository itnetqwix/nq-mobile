import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";

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
      extraInfo: t.extraInfo,
      stripe_account_id: t.stripe_account_id,
      commission: t.commission,
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

export type BookedSessionStatus = "booked" | "confirmed" | "canceled" | "completed" | "upcoming";

/** PUT /user/update-booked-session/:id — trainer confirm / cancel (web parity). */
export async function updateBookedSessionStatus(
  sessionId: string,
  booked_status: BookedSessionStatus
): Promise<any> {
  const { data } = await apiClient.put(API_ROUTES.user.updateBookedSession(sessionId), {
    booked_status,
  });
  return data?.result ?? data;
}

export async function fetchFriendRequests(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.friendRequests);
  return res.data?.friendRequests ?? res.data ?? [];
}

export async function fetchSentFriendRequests(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.sentFriendRequests);
  return res.data?.sentRequests ?? res.data ?? [];
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

export async function postSendFriendRequest(receiverId: string): Promise<any> {
  const res = await apiClient.post(API_ROUTES.user.sendFriendRequest, { receiverId });
  return res.data;
}

export async function postCancelFriendRequest(receiverId: string): Promise<any> {
  const res = await apiClient.post(API_ROUTES.user.cancelFriendRequest, { receiverId });
  return res.data;
}

export async function postRemoveFriend(friendId: string): Promise<any> {
  const res = await apiClient.post(API_ROUTES.user.removeFriend, { friendId });
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

export type ProfileUpdate = Partial<{
  fullname: string;
  bio: string;
  time_zone: string;
  category: string;
  hourly_rate: string;
}>;

/**
 * Web parity: trainer profile updates go through `PUT /trainer/profile`; trainee profile
 * updates go through `PUT /trainee/profile`. Both routes spread the body into the user doc.
 */
export async function putProfile(accountType: "Trainer" | "Trainee", body: ProfileUpdate): Promise<void> {
  const url = accountType === "Trainer" ? API_ROUTES.trainer.profile : API_ROUTES.trainee.profile;
  await apiClient.put(url, body);
}

/** Mobile number changes use the dedicated route `POST /user/update-mobile-number` (same as web). */
export async function postUpdateMobileNumber(mobile_no: string): Promise<void> {
  await apiClient.post(API_ROUTES.user.updateMobileNumber, { mobile_no });
}

/**
 * Web parity Contact Us / Write Us submission. Backend reads `description` (not `message`)
 * and accepts optional sender identity fields.
 */
export type WriteUsPayload = {
  name?: string;
  email?: string;
  phone_number?: string;
  subject: string;
  description: string;
};

export async function postWriteUs(payload: WriteUsPayload): Promise<void> {
  await apiClient.post(API_ROUTES.user.writeUs, payload);
}

/**
 * Web parity "Raise concern" — used for both "Report a technical issue" and "Request a refund".
 * Tied to a specific booking via `booking_id`.
 */
export type RaiseConcernReason = "Technical issue" | "Request for Refund";

export type RaiseConcernPayload = {
  name?: string;
  email?: string;
  phone_number?: string;
  reason: RaiseConcernReason;
  subject: string;
  description: string;
  /** `"Yes"` / `"No"` — only meaningful when reason is "Technical issue". */
  is_releted_to_refund?: "Yes" | "No";
  booking_id: string;
};

export async function postRaiseConcern(payload: RaiseConcernPayload): Promise<void> {
  await apiClient.post(API_ROUTES.user.raiseConcern, payload);
}

export async function fetchMyRaiseConcerns(): Promise<any[]> {
  try {
    const res = await apiClient.get(API_ROUTES.user.myRaiseConcerns);
    const body = (res.data as any)?.data ?? res.data?.result;
    return Array.isArray(body) ? body : [];
  } catch {
    return [];
  }
}

export async function fetchMyReferrals(): Promise<any[]> {
  try {
    const res = await apiClient.get(API_ROUTES.user.myReferrals);
    const body = (res.data as any)?.data ?? res.data?.result;
    return Array.isArray(body) ? body : [];
  } catch {
    return [];
  }
}

export type BrowseTrainersParams = {
  search?: string;
  /** @deprecated Use `categories` */
  category?: string;
  /** Comma-separated sport/category labels */
  categories?: string;
  minRating?: number;
  minHourlyRate?: number;
  maxHourlyRate?: number;
  sortBy?: "name" | "rating" | "hourly_rate" | "hourly_rate_desc";
  onlineOnly?: boolean;
  page?: number;
  limit?: number;
};

export async function fetchTrainersWithSlots(params?: BrowseTrainersParams): Promise<any[]> {
  const query: Record<string, string> = {};
  if (params?.search?.trim()) query.search = params.search.trim();
  const cats = params?.categories?.trim() || params?.category?.trim();
  if (cats) query.categories = cats;
  if (params?.minRating != null && params.minRating > 0) {
    query.minRating = String(params.minRating);
  }
  if (params?.minHourlyRate != null && params.minHourlyRate > 0) {
    query.minHourlyRate = String(params.minHourlyRate);
  }
  if (params?.maxHourlyRate != null && params.maxHourlyRate > 0) {
    query.maxHourlyRate = String(params.maxHourlyRate);
  }
  if (params?.sortBy) query.sortBy = params.sortBy;
  if (params?.onlineOnly) query.onlineOnly = "1";
  if (params?.page) query.page = String(params.page);
  if (params?.limit) query.limit = String(params.limit);

  const res = await apiClient.get(API_ROUTES.trainee.getTrainersWithSlots, { params: query });
  const body = res.data as Record<string, unknown>;
  /** Backend: `{ status, data: Trainer[] }` — see `traineeController.getSlotsOfAllTrainers`. */
  const rows = body?.data ?? body?.result;
  if (Array.isArray(rows)) return rows;
  return [];
}

export type TrainerScheduleDay = {
  day: string;
  slots: { start_time: string; end_time: string }[];
};

export async function fetchTrainerSlots(): Promise<TrainerScheduleDay[]> {
  const res = await apiClient.get(API_ROUTES.trainer.getSlots);
  const root = (res.data as any)?.data ?? (res.data as any)?.result ?? res.data;
  const avail = root?.available_slots;
  if (Array.isArray(avail)) return avail as TrainerScheduleDay[];
  return [];
}

/** POST `/trainer/update-slots` — same payload as web `updateSchedulingSlots`. */
export async function postTrainerSlots(payload: TrainerScheduleDay[]): Promise<void> {
  await apiClient.post(API_ROUTES.trainer.updateSlots, { available_slots: payload });
}

/** Normalize locker/list API bodies (`{ data }`, `{ result }`, or bare array). */
function extractApiArray(body: unknown): any[] {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return [];
  const root = body as Record<string, unknown>;
  const nested = root.data ?? root.result ?? root.items;
  if (Array.isArray(nested)) return nested;
  if (nested && typeof nested === "object") {
    const inner = (nested as Record<string, unknown>).data ?? (nested as Record<string, unknown>).result;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

/** POST `/common/get-clips` — returns clips grouped by category (`_id` = category name). */
export async function postMyClipsGrouped(params?: {
  trainee_id?: string;
}): Promise<{ _id: string; clips: any[] }[]> {
  const res = await apiClient.post(API_ROUTES.common.getClips, params ?? {});
  return extractApiArray(res.data);
}

/** POST `/common/trainee-clips` — trainer: clips attached to bookings, grouped by trainee user. */
export async function postTraineeClipsGrouped(): Promise<{ _id: any; clips: any[] }[]> {
  const res = await apiClient.post(API_ROUTES.common.traineeClips, {});
  return extractApiArray(res.data);
}

export async function postGetAllSavedSessions(): Promise<any[]> {
  const res = await apiClient.post(API_ROUTES.common.getAllSavedSessions, {});
  return extractApiArray(res.data);
}

export async function postReportsGetAll(params?: { trainee_id?: string }): Promise<any[]> {
  const res = await apiClient.post(API_ROUTES.report.getAll, params ?? {});
  return extractApiArray(res.data);
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

export async function fetchAllUsers(search?: string): Promise<any[]> {
  /**
   * Backend (`/user/get-all-users`) supports an optional `search` regex on `fullname` + `email`.
   * Used by mobile share-clips to enforce "recipients must be on NetQwix".
   */
  const res = await apiClient.get(API_ROUTES.user.getAllUsers, {
    params: search ? { search } : undefined,
  });
  return res.data?.result ?? res.data ?? [];
}

/**
 * Check whether an email belongs to a NetQwix user. Returns the matching user record
 * (or `null` if not found). The backend regex matches case-insensitively, so we filter
 * client-side for an exact email match before accepting it as a recipient.
 */
export async function setOnlineAvailability(showAsOnline: boolean): Promise<boolean> {
  try {
    const { data } = await apiClient.put(API_ROUTES.user.onlineAvailability, { showAsOnline });
    const inner = (data as { result?: Record<string, unknown> })?.result ?? data;
    if (typeof inner?.showAsOnline === "boolean") return inner.showAsOnline;
    const updatedUser = inner?.user as { showAsOnline?: boolean } | undefined;
    if (typeof updatedUser?.showAsOnline === "boolean") return updatedUser.showAsOnline;
    return showAsOnline;
  } catch (e) {
    throw new Error(getApiErrorMessage(e, "Could not update online status."));
  }
}

export async function findNetqwixUserByEmail(email: string): Promise<any | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const users = await fetchAllUsers(normalized);
  const match = users.find(
    (u: any) => typeof u?.email === "string" && u.email.toLowerCase() === normalized
  );
  return match ?? null;
}
