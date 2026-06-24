import { DateTime } from "luxon";
import {
  SCHEDULED_BOOKING_BUFFER_MINUTES,
  SCHEDULED_MIN_LEAD_TIME_MINUTES,
} from "./constants";

export type SlotWindow = { start: DateTime; end: DateTime };

/** Parse API slot strings like "9:30 AM" on a calendar day in the given IANA zone. */
export function parseSlotTimeOnDate(
  dateIso: string,
  timeLabel: string,
  zone: string
): DateTime | null {
  const datePart = dateIso.split("T")[0]!;
  const formats = ["h:mm a", "hh:mm a", "H:mm", "HH:mm"];
  for (const fmt of formats) {
    const dt = DateTime.fromFormat(`${datePart} ${timeLabel.trim()}`, `yyyy-MM-dd ${fmt}`, {
      zone,
    });
    if (dt.isValid) return dt;
  }
  return null;
}

export function toHHmm(dt: DateTime): string {
  return dt.toFormat("HH:mm");
}

export function formatDisplayTime(dt: DateTime): string {
  return dt.toFormat("h:mm a");
}

/** Merge overlapping/adjacent availability windows. */
export function mergeSlotWindows(windows: SlotWindow[]): SlotWindow[] {
  if (windows.length === 0) return [];
  const sorted = [...windows].sort((a, b) => a.start.toMillis() - b.start.toMillis());
  const merged: SlotWindow[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/** Build selectable start times that fit duration + buffer inside a window. */
export function buildStartCandidates(
  windows: SlotWindow[],
  durationMinutes: number,
  incrementMinutes = 15,
  options?: {
    bufferMinutes?: number;
    minLeadMinutes?: number;
    now?: DateTime;
  }
): DateTime[] {
  const bufferMinutes = options?.bufferMinutes ?? SCHEDULED_BOOKING_BUFFER_MINUTES;
  const minLeadMinutes = options?.minLeadMinutes ?? SCHEDULED_MIN_LEAD_TIME_MINUTES;
  const now = options?.now ?? DateTime.now();
  const minStart = now.plus({ minutes: minLeadMinutes });

  const out: DateTime[] = [];
  const seen = new Set<string>();
  for (const w of windows) {
    let t = w.start;
    while (t.plus({ minutes: durationMinutes + bufferMinutes }) <= w.end) {
      if (t >= minStart) {
        const key = t.toISO()!;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(t);
        }
      }
      t = t.plus({ minutes: incrementMinutes });
    }
  }
  return out.sort((a, b) => a.toMillis() - b.toMillis());
}

export function windowsFromApiSlots(
  slots: Array<{ start: string; end: string }>,
  dateIso: string,
  zone: string
): SlotWindow[] {
  const windows: SlotWindow[] = [];
  for (const s of slots) {
    const start = parseSlotTimeOnDate(dateIso, s.start, zone);
    const end = parseSlotTimeOnDate(dateIso, s.end, zone);
    if (start && end && end > start) windows.push({ start, end });
  }
  return mergeSlotWindows(windows);
}

export function nextDays(count: number, zone: string): DateTime[] {
  const days: DateTime[] = [];
  let d = DateTime.now().setZone(zone).startOf("day");
  for (let i = 0; i < count; i++) {
    days.push(d);
    d = d.plus({ days: 1 });
  }
  return days;
}

/** Map AI suggestion day labels (e.g. "Wednesday", "Jun 18") to a date within the next N days. */
export function resolveSuggestionDateIso(
  dayLabel: string,
  zone: string,
  horizonDays = 14
): string | null {
  const normalized = dayLabel.trim().toLowerCase();
  if (!normalized) return null;
  for (const d of nextDays(horizonDays, zone)) {
    const formats = [
      d.toFormat("cccc"),
      d.toFormat("ccc"),
      d.toFormat("MMM d"),
      d.toFormat("MMMM d"),
      d.toFormat("MMM d, yyyy"),
      d.toISODate()!,
    ];
    if (formats.some((f) => f.toLowerCase() === normalized)) return d.toISODate()!;
  }
  return null;
}

export type TimePeriodGroup = "morning" | "afternoon" | "evening";

export function groupStartCandidatesByPeriod(
  candidates: DateTime[]
): Record<TimePeriodGroup, DateTime[]> {
  const groups: Record<TimePeriodGroup, DateTime[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };
  for (const dt of candidates) {
    const hour = dt.hour;
    if (hour < 12) groups.morning.push(dt);
    else if (hour < 17) groups.afternoon.push(dt);
    else groups.evening.push(dt);
  }
  return groups;
}
