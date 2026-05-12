import { useEffect, useState } from "react";

/**
 * React-Native port of the web `useLessonTimer` (kept minimal — only the displayed
 * countdown, not the pause/extend logic). Accepts either an explicit end timestamp,
 * or a `bookedDate + session_end_time` pair (web parity, "h:mm:ss" stamps relative
 * to the booked date).
 */
type Input = {
  endAtMs?: number | null;
  /** Falls back to `bookedDate + sessionEndTime` ("h:mm:ss") when `endAtMs` is missing. */
  bookedDate?: string;
  sessionEndTime?: string;
};

function combineBookedDateAndTime(bookedDate?: string, hms?: string): number | null {
  if (!bookedDate || !hms) return null;
  const [hStr, mStr, sStr] = hms.split(":");
  const date = new Date(bookedDate);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(Number(hStr) || 0, Number(mStr) || 0, Number(sStr) || 0, 0);
  return date.getTime();
}

export function useLessonCountdown({ endAtMs, bookedDate, sessionEndTime }: Input): {
  remainingMs: number;
  remainingLabel: string;
  expired: boolean;
} {
  const end = endAtMs ?? combineBookedDateAndTime(bookedDate, sessionEndTime);
  const [, force] = useState(0);

  useEffect(() => {
    if (!end) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [end]);

  if (!end) return { remainingMs: 0, remainingLabel: "—", expired: false };
  const remainingMs = Math.max(0, end - Date.now());
  const totalSec = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const label =
    h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  return { remainingMs, remainingLabel: label, expired: remainingMs <= 0 };
}
