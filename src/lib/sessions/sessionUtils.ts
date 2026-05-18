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

import { INSTANT_JOIN_AFTER_ACCEPT_MS } from "./instantLessonConstants";

const EARLY_JOIN_MS = 15 * 60 * 1000;
const LATE_JOIN_MS = 15 * 60 * 1000;

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
    if (!session?.accepted_at) {
      return "Instant lessons can be joined after the coach confirms.";
    }
    if (!canJoinSession(session, now)) {
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
