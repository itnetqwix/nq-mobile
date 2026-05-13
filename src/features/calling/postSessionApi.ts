/**
 * Backend wrappers used by the native post-session flow (ratings, saved
 * lessons, session extension, game-plan report). Names mirror
 * `nq-frontend-main/app/components/common/common.api.js` so a feature parity
 * sweep can find them quickly.
 */

import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";

export type RatingPayload = {
  booking_id: string;
  sessionRating: number;
  audioVideoRating: number;
  recommendRating?: number | null;
  title?: string;
  remarksInfo?: string;
  /** Mobile field added for parity — backend tolerates extras. */
  accountType?: string;
};

/** Web: `addRating()` — PUT /user/rating. */
export async function postRating(payload: RatingPayload) {
  const res = await apiClient.put(API_ROUTES.user.rating, payload);
  return res.data;
}

export type ExtendSessionPayload = {
  booking_id: string;
  extended_session_end_time: string;
};

/** Web: `updateExtendedSessionTime()` — POST /common/extend-session-end-time. */
export async function postExtendSession(payload: ExtendSessionPayload) {
  const res = await apiClient.post(
    API_ROUTES.common.extendSessionEndTime,
    payload
  );
  return res.data;
}

export type SavedLessonUploadUrl = {
  uploadUrl: string;
  fileName: string;
};

/**
 * Web: `getSavedSessionsUploadUrl()` — POST /common/saved-sessions-upload-url.
 * Returns a presigned PUT URL the client uses to upload the captured lesson.
 */
export async function getSavedLessonUploadUrl(params: {
  contentType: string;
  /** Suggested extension (`.mp4` / `.webm` / `.jpg`). */
  extension?: string;
}): Promise<SavedLessonUploadUrl> {
  const res = await apiClient.post(API_ROUTES.common.savedSessionsUploadUrl, {
    contentType: params.contentType,
    extension: params.extension,
  });
  const data = res.data?.data ?? res.data;
  return {
    uploadUrl: data?.uploadUrl ?? data?.url ?? "",
    fileName: data?.fileName ?? data?.key ?? data?.file_name ?? "",
  };
}

export type SavedLessonRow = {
  _id: string;
  title?: string;
  url?: string;
  file_name?: string;
  createdAt?: string;
};

export async function fetchSavedLessons(): Promise<SavedLessonRow[]> {
  const res = await apiClient.post(API_ROUTES.common.getAllSavedSessions, {});
  const raw = res.data?.data ?? res.data?.result ?? res.data;
  return Array.isArray(raw) ? raw : [];
}

/**
 * Trainer-only: creates the post-session "game plan" report (web mirrors this
 * via `ReportModal`). Skeleton helper — the real upload pipeline (images,
 * recording) requires the same series of `/report/add-image` follow-ups the
 * web does. This wrapper just lets the trainer create the parent report.
 */
export type CreateReportPayload = {
  booking_id: string;
  title?: string;
  remarks?: string;
};
export async function postCreateReport(payload: CreateReportPayload) {
  const res = await apiClient.post(API_ROUTES.report.create, payload);
  return res.data;
}
