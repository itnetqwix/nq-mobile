import {
  INSTANT_ACCEPT_WINDOW_MS,
  INSTANT_JOIN_AFTER_ACCEPT_MS,
} from "./instantLessonConstants";
import { getRefundReasonI18nKey } from "./refundReasonLabels";

const EARLY_JOIN_MS = 15 * 60 * 1000;
const LATE_JOIN_MS = 15 * 60 * 1000;

/** Normalize API status strings (`booked`, `confirmed`, `confirm`, …). */
export function normalizeSessionStatus(status?: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s === "confirm" || s === "confirmed") return "confirmed";
  if (s === "booked") return "booked";
  if (s === "cancel" || s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "completed") return "completed";
  if (s === "upcoming") return "upcoming";
  return s || "booked";
}

export function isPendingBooking(session: any): boolean {
  return normalizeSessionStatus(session?.status) === "booked";
}

export function isInstantLesson(session: any): boolean {
  if (typeof session?.is_instant === "boolean") return session.is_instant;
  /** Scheduled bookings always have slot times or ISO start/end. */
  if (session?.session_start_time || session?.session_end_time) return false;
  if (session?.start_time && session?.end_time && session?.time_zone) return false;
  return !session?.time_zone && !session?.session_start_time && !session?.session_end_time;
}

function parseYmdHm(
  bookedDate: string | Date | undefined,
  hm: string | undefined
): Date | null {
  if (!bookedDate || !hm) return null;
  try {
    const d = new Date(bookedDate);
    const [h, m] = String(hm).split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
  } catch {
    return null;
  }
}

export function getSessionStart(session: any): Date | null {
  if (session?.start_time) {
    const d = new Date(session.start_time);
    if (Number.isFinite(d.getTime())) return d;
  }
  return (
    parseYmdHm(session?.booked_date, session?.session_start_time) ??
    (session?.booked_date ? new Date(session.booked_date) : null)
  );
}

export function getSessionEnd(session: any): Date | null {
  if (session?.end_time) {
    const d = new Date(session.end_time);
    if (Number.isFinite(d.getTime())) return d;
  }
  return parseYmdHm(session?.booked_date, session?.session_end_time);
}

export function formatSessionWhen(session: any): { dateLabel: string; timeLabel: string } {
  const start = getSessionStart(session);
  const end = getSessionEnd(session);
  if (!start) {
    const raw = session?.booked_date;
    return {
      dateLabel: raw ? String(raw).slice(0, 10) : "—",
      timeLabel:
        session?.session_start_time && session?.session_end_time
          ? `${session.session_start_time} – ${session.session_end_time}`
          : "",
    };
  }
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = end
    ? `${start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
    : start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return { dateLabel, timeLabel };
}

export function getInstantAcceptDeadlineMs(session: any): number | null {
  if (!isInstantLesson(session) || !isPendingBooking(session)) return null;
  const raw = session?.accept_deadline_at ?? session?.acceptDeadlineAt;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function getInstantJoinDeadlineMs(session: any): number | null {
  if (!isInstantLesson(session)) return null;
  const status = normalizeSessionStatus(session?.status);
  if (status !== "confirmed") return null;
  const raw = session?.join_deadline_at ?? session?.joinDeadlineAt;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function resolveAcceptDeadlineMs(session: any): number | null {
  const fromApi = getInstantAcceptDeadlineMs(session);
  if (fromApi != null) return fromApi;
  const requested = session?.requested_at ?? session?.createdAt;
  if (!requested) return null;
  const ms = new Date(requested).getTime();
  return Number.isFinite(ms) ? ms + INSTANT_ACCEPT_WINDOW_MS : null;
}

function resolveJoinDeadlineMs(session: any): number | null {
  const fromApi = getInstantJoinDeadlineMs(session);
  if (fromApi != null) return fromApi;
  const acceptedAt = session?.accepted_at ? new Date(session.accepted_at).getTime() : NaN;
  if (!Number.isFinite(acceptedAt)) return null;
  return acceptedAt + INSTANT_JOIN_AFTER_ACCEPT_MS;
}

/** Instant request still within trainer accept window. */
export function isInstantAcceptExpired(session: any, now = new Date()): boolean {
  if (!isInstantLesson(session) || !isPendingBooking(session)) return false;
  const deadline = resolveAcceptDeadlineMs(session);
  if (deadline == null) return false;
  return now.getTime() > deadline;
}

/** Instant lesson has started (both parties joined or server marked ACTIVE). */
export function isInstantLessonLive(session: any): boolean {
  if (!isInstantLesson(session)) return false;
  if (session?.both_joined_at) return true;
  const phase = String(session?.instant_phase ?? "").toUpperCase();
  return phase === "ACTIVE";
}

/** Scheduled end of an instant lesson (duration / end_time), with late rejoin buffer. */
export function getInstantLessonEndMs(session: any): number | null {
  if (!isInstantLesson(session)) return null;
  const end = getSessionEnd(session);
  if (end) return end.getTime() + LATE_JOIN_MS;
  const start = getSessionStart(session);
  const durationMin = Number(session?.duration ?? session?.lesson_duration);
  if (start && Number.isFinite(durationMin) && durationMin > 0) {
    return start.getTime() + durationMin * 60 * 1000 + LATE_JOIN_MS;
  }
  return null;
}

/** Instant lesson past join window after coach accepted (first join only). */
export function isInstantJoinExpired(session: any, now = new Date()): boolean {
  if (!isInstantLesson(session)) return false;
  if (isInstantLessonLive(session)) {
    const endMs = getInstantLessonEndMs(session);
    if (endMs != null) return now.getTime() > endMs;
    return false;
  }
  const status = normalizeSessionStatus(session?.status);
  if (status !== "confirmed" && status !== "upcoming") return false;
  const deadline = resolveJoinDeadlineMs(session);
  if (deadline == null) return false;
  return now.getTime() > deadline;
}

/** Hide from upcoming/confirmed lists (accept or join window elapsed). */
export function isInstantExpiredForLists(session: any, now = new Date()): boolean {
  if (isInstantLessonLive(session)) {
    const endMs = getInstantLessonEndMs(session);
    if (endMs == null) return false;
    return now.getTime() > endMs;
  }
  return isInstantAcceptExpired(session, now) || isInstantJoinExpired(session, now);
}

/** Trainer dashboard “Session requests” — pending rows still actionable. */
export function shouldShowInDashboardRequests(session: any, now = new Date()): boolean {
  if (!isPendingBooking(session)) return false;
  if (isInstantLesson(session) && isInstantAcceptExpired(session, now)) return false;
  return true;
}

/** Trainer/trainee dashboard “Upcoming” preview (non-active, non-pending). */
export function shouldShowInDashboardUpcoming(session: any, now = new Date()): boolean {
  const status = normalizeSessionStatus(session?.status);
  if (isPendingBooking(session)) return false;
  if (status === "cancelled" || status === "completed") return false;
  if (isInstantExpiredForLists(session, now)) return false;
  if (isSessionInProgress(session, now)) return false;

  if (!isInstantLesson(session)) {
    const end = getSessionEnd(session);
    const start = getSessionStart(session);
    if (end || start) {
      const endMs = (end ?? start)!.getTime() + LATE_JOIN_MS;
      if (now.getTime() > endMs) return false;
    }
  }

  return true;
}

/** Cancelled, completed, or client-detectable expired (before API refresh). */
export function isSessionTerminalForUI(session: any, now = new Date()): boolean {
  const status = normalizeSessionStatus(session?.status);
  if (status === "cancelled" || status === "completed") return true;
  if (isInstantLesson(session) && isInstantLessonLive(session)) {
    const endMs = getInstantLessonEndMs(session);
    if (endMs == null) return false;
    return now.getTime() > endMs;
  }
  return isInstantExpiredForLists(session, now);
}

/** i18n key for list cards and detail banners (`sessions.outcome.*`). */
export function getSessionOutcomeI18nKey(session: any, now = new Date()): string | null {
  const refundReason =
    session?._refund?.reason ??
    session?.refund_reason ??
    session?.refundReason ??
    null;
  const fromReason = getRefundReasonI18nKey(refundReason);
  if (fromReason) return fromReason;

  const status = normalizeSessionStatus(session?.status);
  if (status === "cancelled") {
    return "sessions.outcome.cancelled";
  }

  if (isInstantAcceptExpired(session, now)) {
    return "sessions.outcome.acceptExpired";
  }
  if (isInstantJoinExpired(session, now)) {
    return "sessions.outcome.joinExpired";
  }

  const phase = String(session?.instant_phase ?? "").toLowerCase();
  if (phase === "cancelled") {
    return "sessions.outcome.cancelled";
  }

  return null;
}

/** Whether a session is currently in its live / rejoinable window (dashboard “Active”). */
export function isSessionInProgress(session: any, now = new Date()): boolean {
  const status = normalizeSessionStatus(session?.status);
  if (status === "cancelled" || status === "completed") return false;

  if (isInstantLesson(session)) {
    if (isPendingBooking(session)) return false;
    const phase = String(session?.instant_phase ?? "").toUpperCase();
    if (phase === "ACTIVE") return true;
    if (session?.both_joined_at) return true;
    if (canJoinSession(session, now)) return true;
    return canRejoinLesson(session, now);
  }

  if (!session?.booked_date || !session?.start_time || !session?.end_time) {
    return canRejoinLesson(session, now);
  }

  try {
    const nowMs = now.getTime();
    const [sh, sm] = String(session.start_time).split(":").map(Number);
    const [eh, em] = String(session.end_time).split(":").map(Number);
    const [dy, dm, dd] = String(session.booked_date).split("-").map(Number);
    const start = new Date(dy, dm - 1, dd, sh, sm);
    const end = new Date(dy, dm - 1, dd, eh, em);
    if (start > end) end.setDate(end.getDate() + 1);
    if (nowMs >= start.getTime() && nowMs <= end.getTime()) return true;
    return canRejoinLesson(session, now);
  } catch {
    return canRejoinLesson(session, now);
  }
}

/**
 * Rejoin an in-progress lesson (same booking id) until the scheduled window ends.
 * Used when a user dropped and needs to return before the server marks completed.
 */
export function canRejoinLesson(session: any, now = new Date()): boolean {
  const status = normalizeSessionStatus(session?.status);
  if (status === "cancelled" || status === "completed") return false;
  if (canJoinSession(session, now)) return true;

  if (isInstantLesson(session) && isInstantLessonLive(session)) {
    const endMs = getInstantLessonEndMs(session);
    if (endMs == null) return status === "confirmed" || status === "upcoming";
    return (
      now.getTime() <= endMs &&
      (status === "confirmed" || status === "upcoming")
    );
  }

  if (session?.both_joined_at) return true;
  const phase = String(session?.instant_phase ?? "").toUpperCase();
  if (phase === "ACTIVE") return true;
  const start = getSessionStart(session);
  if (!start) return false;
  const end = getSessionEnd(session);
  const endMs = (end ?? start).getTime() + LATE_JOIN_MS;
  return now.getTime() <= endMs && (status === "confirmed" || status === "upcoming");
}

/** Whether the Join button should be enabled (web `meetingAvailability` parity). */
export function canJoinSession(session: any, now = new Date()): boolean {
  const status = normalizeSessionStatus(session?.status);
  if (status === "cancelled" || status === "completed") return false;
  if (isPendingBooking(session)) return false;
  if (status !== "confirmed" && status !== "upcoming") return false;

  const nowMs = now.getTime();

  if (isInstantLesson(session)) {
    const joinDeadline = session?.join_deadline_at
      ? new Date(session.join_deadline_at).getTime()
      : NaN;
    if (Number.isFinite(joinDeadline)) {
      return nowMs <= joinDeadline;
    }
    const acceptedAt = session?.accepted_at
      ? new Date(session.accepted_at).getTime()
      : NaN;
    if (!Number.isFinite(acceptedAt)) return false;
    return nowMs - acceptedAt <= INSTANT_JOIN_AFTER_ACCEPT_MS;
  }

  const start = getSessionStart(session);
  const end = getSessionEnd(session);

  /** Legacy / instant-style rows without ISO slot times — match web (allow join when confirmed). */
  if (!session?.start_time && !session?.end_time && !session?.session_start_time) {
    return status === "confirmed" || status === "upcoming";
  }

  if (!start) return status === "confirmed" || status === "upcoming";

  const endMs = (end ?? start).getTime() + LATE_JOIN_MS;
  return nowMs >= start.getTime() - EARLY_JOIN_MS && nowMs <= endMs;
}

/** Join or rejoin — for session list / detail CTAs. */
export function canEnterLesson(session: any, now = new Date()): boolean {
  return canJoinSession(session, now) || canRejoinLesson(session, now);
}

/** User-facing reason Join is disabled (for hints under the button). */
export function getJoinDisabledReason(session: any, now = new Date()): string {
  const status = normalizeSessionStatus(session?.status);
  if (isPendingBooking(session)) {
    return "Confirm this session first. Join is available after confirmation.";
  }
  if (status === "cancelled") return "This session was cancelled.";
  if (status === "completed") return "This session has already ended.";
  if (status !== "confirmed" && status !== "upcoming") {
    return "This session is not ready to join yet.";
  }

  if (isInstantLesson(session)) {
    if (!session?.accepted_at && !session?.both_joined_at) {
      return "Instant lessons can be joined after the coach confirms.";
    }
    if (isInstantLessonLive(session)) {
      const endMs = getInstantLessonEndMs(session);
      if (endMs != null && now.getTime() > endMs) {
        return "This instant lesson has ended.";
      }
      if (!canRejoinLesson(session, now)) {
        return "This instant lesson is no longer available.";
      }
      return "";
    }
    if (!canJoinSession(session, now) && !canRejoinLesson(session, now)) {
      return "The join window for this instant lesson has expired.";
    }
  }

  const start = getSessionStart(session);
  if (!start) return "";

  const nowMs = now.getTime();
  const openMs = start.getTime() - EARLY_JOIN_MS;
  if (nowMs < openMs) {
    const openAt = new Date(openMs);
    return `Join opens at ${openAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} (15 min before start).`;
  }

  const end = getSessionEnd(session);
  const endMs = (end ?? start).getTime() + LATE_JOIN_MS;
  if (nowMs > endMs) {
    return "The join window for this session has ended.";
  }

  return "";
}

export function getOtherParty(session: any, isTrainer: boolean) {
  return isTrainer ? session?.trainee_info : session?.trainer_info;
}

/** Extract booking id from socket notification payloads. */
export function extractBookingIdFromNotification(payload: {
  bookingInfo?: Record<string, unknown>;
}): string | undefined {
  const info = payload?.bookingInfo;
  if (!info) return undefined;
  const raw =
    info.bookingId ?? info.booking_id ?? info._id ?? info.id ?? info.sessionId;
  return raw != null ? String(raw) : undefined;
}

export function isNewBookingNotificationTitle(title?: string | null): boolean {
  const t = (title ?? "").toLowerCase();
  return t.includes("booking request") || t.includes("instant lesson request");
}
