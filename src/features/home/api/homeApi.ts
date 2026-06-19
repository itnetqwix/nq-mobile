import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { dedupeRowsById, dedupeTrainersById } from "../../../lib/lists/trainerListUtils";

export { dedupeRowsById } from "../../../lib/lists/trainerListUtils";

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
  return dedupeTrainersById(out);
}

export type InstantEligibilityResult = {
  eligible: boolean;
  reasons: string[];
  durationMinutes: number;
  totalWindowMinutes: number;
  acceptDeadlinePreview?: string;
  trainerTimezone?: string;
};

export async function fetchInstantLessonEligibility(
  trainerId: string,
  durationMinutes: number
): Promise<InstantEligibilityResult> {
  const res = await apiClient.get(API_ROUTES.trainee.instantLessonEligibility, {
    params: { trainerId, durationMinutes },
  });
  return res.data?.data ?? res.data;
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
export async function fetchScheduledMeetings(
  status = "upcoming",
  options?: { limit?: number; id?: string }
): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.scheduledMeetings, {
    params: {
      status,
      limit: options?.limit ?? 100,
      ...(options?.id ? { id: options.id } : {}),
    },
  });
  const body = res.data?.result ?? res.data;
  const rows = Array.isArray(body) ? body : body && Array.isArray(body.data) ? body.data : [];
  return dedupeRowsById(rows);
}

/**
 * Load a single booking row for the meeting screen (ICE servers, clips, participants).
 * Mirrors web `MeetingPage` which reads `iceServers` from scheduled meeting details.
 */
export async function fetchMeetingSession(lessonId: string): Promise<any | null> {
  if (!lessonId) return null;
  for (const status of ["upcoming", "confirmed"] as const) {
    try {
      const res = await apiClient.get(API_ROUTES.user.scheduledMeetings, {
        params: { id: lessonId, status, limit: 1 },
      });
      const body = res.data?.result ?? res.data;
      const rows = Array.isArray(body) ? body : body?.data;
      if (Array.isArray(rows) && rows.length > 0) return rows[0];
    } catch {
      /** try next status */
    }
  }
  return null;
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

export type EndSessionEarlyResponse = {
  session?: {
    status?: string;
    actual_end_at?: string;
    end_time?: string;
    early_end_trainer_ack_at?: string | null;
    early_end_trainee_ack_at?: string | null;
  };
};

/** POST /user/session-end-early/:sessionId — mark live session ended before booked window ends. */
export async function endSessionEarly(sessionId: string): Promise<EndSessionEarlyResponse> {
  const { data } = await apiClient.post(API_ROUTES.user.sessionEndEarly(sessionId));
  return (data?.data ?? data?.result ?? data) as EndSessionEarlyResponse;
}

export type SessionDepartureStatus = {
  sessionId: string;
  active: boolean;
  initiatedByRole: "trainer" | "trainee" | null;
  initiatedByUserId: string | null;
  initiatedAt: string | null;
  pendingForUserId: string | null;
  stayedActiveAt: string | null;
  rejoinDeadlineAt: string | null;
  concernRaisedAt: string | null;
  canRaiseConcern: boolean;
  bookedEndAt: string | null;
  /** Present when the booking row has actual_end_at set. */
  actualEndAt?: string | null;
};

export type SessionDepartureResponse = {
  departure?: SessionDepartureStatus;
  ended?: boolean;
  submitted?: boolean;
};

/** True when the session booking has ended (from GET or POST departure APIs). */
export function isSessionEndedFromDeparture(
  res: SessionDepartureResponse | null | undefined
): boolean {
  if (!res) return false;
  if (res.ended === true) return true;
  if (res.departure?.actualEndAt) return true;
  return false;
}

/** POST /user/session-departure/:sessionId — initiate asymmetric end-call departure. */
export async function initiateSessionDeparture(
  sessionId: string
): Promise<SessionDepartureResponse> {
  const { data } = await apiClient.post(API_ROUTES.user.sessionDeparture(sessionId));
  return (data?.data ?? data?.result ?? data) as SessionDepartureResponse;
}

/** POST /user/session-departure-response/:sessionId */
export async function respondSessionDeparture(
  sessionId: string,
  acceptEnd: boolean
): Promise<SessionDepartureResponse> {
  const { data } = await apiClient.post(API_ROUTES.user.sessionDepartureResponse(sessionId), {
    acceptEnd,
  });
  return (data?.data ?? data?.result ?? data) as SessionDepartureResponse;
}

/** POST /user/session-departure-concern/:sessionId */
export async function raiseSessionDepartureConcern(
  sessionId: string,
  description?: string
): Promise<SessionDepartureResponse> {
  const { data } = await apiClient.post(API_ROUTES.user.sessionDepartureConcern(sessionId), {
    description,
  });
  return (data?.data ?? data?.result ?? data) as SessionDepartureResponse;
}

/** GET /user/session-departure-status/:sessionId */
export async function fetchSessionDepartureStatus(
  sessionId: string
): Promise<SessionDepartureResponse> {
  const { data } = await apiClient.get(API_ROUTES.user.sessionDepartureStatus(sessionId));
  return (data?.data ?? data?.result ?? data) as SessionDepartureResponse;
}

export type SessionDetailResponse = {
  session: Record<string, unknown>;
  trainer: Record<string, unknown> | null;
  trainee: Record<string, unknown> | null;
  escrow: Record<string, unknown> | null;
  payment?: Record<string, unknown>;
  refund?: {
    status?: string | null;
    reason?: string | null;
    reason_label?: string | null;
    transfer?: Record<string, unknown> | null;
  };
  ops_events?: Array<Record<string, unknown>>;
};

/** Full session payload for booking detail modals (trainer + trainee). */
export async function fetchSessionDetail(bookingId: string): Promise<SessionDetailResponse> {
  const res = await apiClient.get(API_ROUTES.user.sessionDetail(bookingId));
  return res.data?.data ?? res.data;
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

export type MyTrainerStats = {
  avgRating: number | null;
  reviewCount: number;
  reviews: Array<{
    _id?: string;
    updatedAt?: string;
    status?: string;
    trainee_fullname?: string;
    trainee_picture?: string;
    ratings?: {
      trainee?: {
        sessionRating?: number;
        audioVideoRating?: number;
        recommendRating?: number;
        title?: string;
        remarksInfo?: string;
        comment?: string;
      };
    };
  }>;
};

export async function fetchMyTrainerStats(): Promise<MyTrainerStats> {
  const res = await apiClient.get(API_ROUTES.trainer.myStats, {
    _skipAuthSignOut: true,
  } as { _skipAuthSignOut: boolean });
  const raw = (res.data?.data ?? res.data?.result ?? res.data ?? {}) as Partial<MyTrainerStats>;
  return {
    avgRating: typeof raw.avgRating === "number" ? raw.avgRating : null,
    reviewCount:
      typeof raw.reviewCount === "number" && Number.isFinite(raw.reviewCount)
        ? raw.reviewCount
        : 0,
    reviews: Array.isArray(raw.reviews) ? raw.reviews : [],
  };
}

export async function fetchRecentTrainers(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.trainee.recentTrainers);
  const raw = res.data?.result ?? res.data ?? [];
  return Array.isArray(raw) ? dedupeRowsById(raw) : [];
}

export type PersonalizedReason =
  | "past_session_repeat"
  | "past_session_same_category"
  | "guest_view"
  | "guest_favorite"
  | "recently_viewed"
  | "online_now";

export type PersonalizedFeedRow = {
  trainer_id: string;
  reasons: PersonalizedReason[];
  primary_reason?: PersonalizedReason;
  repeat_count: number;
};

export type PersonalizedFeedResult = {
  for_you: Record<string, unknown>[];
  reasoning: PersonalizedFeedRow[];
};

export async function fetchPersonalizedFeed(params: {
  limit?: number;
  recentTrainerIds?: string[];
}): Promise<PersonalizedFeedResult> {
  const res = await apiClient.get(API_ROUTES.trainee.personalizedFeed, {
    params: {
      limit: params.limit ?? 12,
      recentTrainerIds: params.recentTrainerIds?.length
        ? params.recentTrainerIds.join(",")
        : undefined,
    },
  });
  const raw = (res.data?.data ?? res.data?.result ?? res.data ?? {}) as {
    for_you?: unknown;
    reasoning?: unknown;
  };
  return {
    for_you: Array.isArray(raw.for_you)
      ? dedupeTrainersById(raw.for_you as Record<string, unknown>[])
      : [],
    reasoning: Array.isArray(raw.reasoning)
      ? (raw.reasoning as PersonalizedFeedRow[])
      : [],
  };
}

export async function fetchGuestSeededTrainers(limit = 12): Promise<Record<string, unknown>[]> {
  const res = await apiClient.get(API_ROUTES.trainee.guestSeededTrainers, {
    params: { limit },
  });
  const raw = res.data?.data ?? res.data?.result ?? res.data ?? [];
  return Array.isArray(raw)
    ? dedupeTrainersById(raw as Record<string, unknown>[])
    : [];
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
  if (Array.isArray(list)) return dedupeRowsById(list);
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
  if (Array.isArray(rows)) return dedupeRowsById(rows);
  return [];
}

export async function postInviteFriendEmail(
  userEmail: string,
  targetAccountType?: "Trainer" | "Trainee"
): Promise<void> {
  await apiClient.post(API_ROUTES.user.inviteFriend, {
    user_email: userEmail.toLowerCase().trim(),
    ...(targetAccountType ? { targetAccountType } : {}),
  });
}

export type BookingReminderCadence = "standard" | "minimal" | "aggressive" | "off";

export type UserNotificationPrefs = {
  promotional: { email: boolean; sms: boolean };
  transactional: { email: boolean; sms: boolean };
  bookingReminderCadence: BookingReminderCadence;
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
  preferred_locale: string;
  category: string;
  hourly_rate: string;
  extraInfo: Record<string, unknown>;
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
  sortBy?: "name" | "rating" | "hourly_rate" | "hourly_rate_desc" | "next_available";
  onlineOnly?: boolean;
  hasSlotsOnly?: boolean;
  page?: number;
  limit?: number;
  /** Trainee IANA timezone — directory returns today-only slot counts in this zone. */
  traineeTimeZone?: string;
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
  if (params?.hasSlotsOnly) query.hasSlotsOnly = "1";
  if (params?.page) query.page = String(params.page);
  if (params?.limit) query.limit = String(params.limit);
  if (params?.traineeTimeZone?.trim()) {
    query.traineeTimeZone = params.traineeTimeZone.trim();
  }

  const res = await apiClient.get(API_ROUTES.trainee.getTrainersWithSlots, { params: query });
  const body = res.data as Record<string, unknown>;
  /** Backend: `{ status, data: Trainer[] }` — see `traineeController.getSlotsOfAllTrainers`. */
  const rows = body?.data ?? body?.result;
  if (!Array.isArray(rows)) return [];

  const filtered = rows.filter((row) => {
    const r = row as Record<string, unknown>;
    if (r.isVerified === true) return true;
    const status = String(r.status ?? "").toLowerCase();
    if (status !== "approved") return false;
    const tv = r.trainer_verification as Record<string, unknown> | undefined;
    const step = String(tv?.onboarding_step ?? "");
    if (step === "completed") return true;
    return step === "account_created" && !tv?.submitted_for_review_at;
  });
  return dedupeTrainersById(filtered);
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

/** POST `/common/get-clips` — nested category → subcategory groups. */
export async function postMyClipsGrouped(params?: { trainee_id?: string }) {
  const { postMyClipsNested } = await import("../../clips/api/clipsApi");
  return postMyClipsNested(params);
}

/** POST `/common/get-shared-clips` — grouped by sharer name. */
export async function postSharedClipsGrouped() {
  const { postSharedClipsBySharer } = await import("../../clips/api/clipsApi");
  return postSharedClipsBySharer();
}

/** POST `/common/get-library-clips` — NetQwix library nested groups. */
export async function postLibraryClipsGrouped() {
  const { postLibraryClipsNested } = await import("../../clips/api/clipsApi");
  return postLibraryClipsNested();
}

export type StoragePlanInfo = {
  planId: string;
  planLabel: string;
  quotaBytes: number;
  usedBytes: number;
  maxClipFileBytes?: number;
  billingInterval: string | null;
  plans: {
    id: string;
    label: string;
    quotaBytes: number;
    monthlyPrice: number;
    yearlyPrice: number;
    yearlySavingsPercent: number;
  }[];
};

export async function fetchStorageInfo(): Promise<StoragePlanInfo> {
  const res = await apiClient.get(API_ROUTES.user.storage);
  return (res.data?.data ?? res.data?.result ?? res.data) as StoragePlanInfo;
}

export async function createStorageCheckout(
  planId: string,
  interval: "monthly" | "yearly" | "one_time"
): Promise<{ client_secret: string; paymentIntentId?: string; subscriptionId?: string }> {
  const res = await apiClient.post(API_ROUTES.user.storageCheckout, { planId, interval });
  return (res.data?.data ?? res.data?.result ?? res.data) as {
    client_secret: string;
    paymentIntentId?: string;
    subscriptionId?: string;
  };
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
  fileSizeBytes?: number;
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

export type ClipConfirmPayload = {
  videoKey: string;
  thumbnailKey: string;
  fileType: string;
  title: string;
  category?: string;
  category_id?: string;
  subcategory_id?: string;
  fileSizeBytes: number;
  shareOptions: {
    type: string;
    friends?: string[];
    emails?: string[];
  };
};

/** Register clip in DB after S3 PUT (`POST /storage/clips/confirm`). */
export async function postClipConfirm(
  payload: ClipConfirmPayload
): Promise<{ clipId: string | null }> {
  const res = await apiClient.post(API_ROUTES.storage.clipsConfirm, payload);
  const body = (res.data ?? {}) as {
    success?: number;
    clipId?: string | null;
    message?: string;
  };
  if (body.success !== 1) {
    throw new Error(body.message || "Failed to save clip.");
  }
  return { clipId: body.clipId ?? null };
}

/** Presign → PUT video + thumbnail → confirm (replaces `/common/video-upload-url`). */
export async function uploadLockerClip(params: {
  videoUri: string;
  videoMime: string;
  videoSizeBytes: number;
  thumbUri: string;
  title: string;
  category?: string;
  category_id?: string;
  subcategory_id?: string;
  shareOptions: ClipConfirmPayload["shareOptions"];
  onVideoProgress?: (percent: number) => void;
  onThumbProgress?: (percent: number) => void;
}): Promise<{ clipId: string | null }> {
  const { putFileToPresignedUrl } = await import("../../../lib/presignedPut");

  const videoPresign = await postClipPresignUpload({
    contentType: params.videoMime,
    sizeBytes: params.videoSizeBytes,
    purpose: "clip",
  });
  const thumbPresign = await postClipPresignUpload({
    contentType: "image/jpeg",
    sizeBytes: 0,
    purpose: "thumbnail",
  });

  await putFileToPresignedUrl(
    videoPresign.uploadUrl,
    params.videoUri,
    params.videoMime,
    params.onVideoProgress
      ? ({ percent }) => params.onVideoProgress!(percent)
      : undefined
  );
  await putFileToPresignedUrl(
    thumbPresign.uploadUrl,
    params.thumbUri,
    "image/jpeg",
    params.onThumbProgress
      ? ({ percent }) => params.onThumbProgress!(percent)
      : undefined
  );

  return postClipConfirm({
    videoKey: videoPresign.key,
    thumbnailKey: thumbPresign.key,
    fileType: params.videoMime,
    title: params.title,
    category: params.category,
    category_id: params.category_id,
    subcategory_id: params.subcategory_id,
    fileSizeBytes: params.videoSizeBytes,
    shareOptions: params.shareOptions,
  });
}

/** Month 2: single-clip presigned PUT (`POST /storage/clips/presign`). */
export async function postClipPresignUpload(params: {
  contentType: string;
  filename?: string;
  sizeBytes?: number;
  purpose?: "clip" | "thumbnail";
}): Promise<{ uploadUrl: string; key: string; mediaUrl: string; expiresIn: number }> {
  const res = await apiClient.post(API_ROUTES.storage.clipsPresign, {
    contentType: params.contentType,
    filename: params.filename,
    sizeBytes: params.sizeBytes,
    purpose: params.purpose,
  });
  const body = (res.data ?? {}) as {
    success?: number;
    uploadUrl?: string;
    key?: string;
    mediaUrl?: string;
    expiresIn?: number;
    message?: string;
  };
  if (body.success !== 1 || !body.uploadUrl || !body.mediaUrl) {
    throw new Error(body.message || "Failed to get upload URL");
  }
  return {
    uploadUrl: body.uploadUrl,
    key: body.key ?? "",
    mediaUrl: body.mediaUrl,
    expiresIn: body.expiresIn ?? 900,
  };
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

/** Keep trainer visible for instant booking while the app is backgrounded (not force-killed). */
export async function setOnlineBackgroundGrace(graceMinutes = 15): Promise<void> {
  await apiClient.put(API_ROUTES.user.onlineBackgroundGrace, { graceMinutes });
}

export async function clearOnlineBackgroundGrace(): Promise<void> {
  await apiClient.delete(API_ROUTES.user.onlineBackgroundGrace);
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
