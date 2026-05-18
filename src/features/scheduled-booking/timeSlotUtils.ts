import { DateTime } from "luxon";

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

/** Build selectable start times (15-min grid) that fit `durationMinutes` inside a window. */
export function buildStartCandidates(
  windows: SlotWindow[],
  durationMinutes: number,
  incrementMinutes = 15
): DateTime[] {
  const out: DateTime[] = [];
  const seen = new Set<string>();
  for (const w of windows) {
    let t = w.start;
    while (t.plus({ minutes: durationMinutes }) <= w.end) {
      const key = t.toISO()!;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(t);
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
