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

const INSTANT_JOIN_MS = 60 * 60 * 1000;
const EARLY_JOIN_MS = 15 * 60 * 1000;
const LATE_JOIN_MS = 15 * 60 * 1000;

/** Whether the Join button should be enabled (web `meetingAvailability` parity). */
export function canJoinSession(session: any, now = new Date()): boolean {
  const status = normalizeSessionStatus(session?.status);
  if (status === "cancelled" || status === "completed") return false;
  if (isPendingBooking(session)) return false;
  if (status !== "confirmed" && status !== "upcoming") return false;

  const nowMs = now.getTime();

  if (isInstantLesson(session)) {
    const bookedAt = session?.booked_date ? new Date(session.booked_date).getTime() : NaN;
    if (!Number.isFinite(bookedAt)) return true;
    return nowMs - bookedAt <= INSTANT_JOIN_MS;
  }

  const start = getSessionStart(session);
  const end = getSessionEnd(session);
  if (!start) return status === "confirmed";
  const endMs = (end ?? start).getTime() + LATE_JOIN_MS;
  return nowMs >= start.getTime() - EARLY_JOIN_MS && nowMs <= endMs;
}

export function getOtherParty(session: any, isTrainer: boolean) {
  return isTrainer ? session?.trainee_info : session?.trainer_info;
}
