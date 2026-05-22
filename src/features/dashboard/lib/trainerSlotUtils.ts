import type { TrainerScheduleDay } from "../../home/api/homeApi";

/** First future slot label for dashboard (e.g. "Thu 3:00 PM"). */
export function formatNextOpenSlot(slots: TrainerScheduleDay[]): string | null {
  const now = Date.now();
  for (const day of slots) {
    const dayStr = String(day.day ?? "");
    if (!dayStr || !Array.isArray(day.slots)) continue;
    for (const slot of day.slots) {
      const start = String(slot.start_time ?? "");
      if (!start) continue;
      const iso = dayStr.includes("T") ? dayStr : `${dayStr}T${start}`;
      const ms = new Date(iso).getTime();
      if (Number.isFinite(ms) && ms > now) {
        const d = new Date(ms);
        const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
        const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        return `${weekday} ${time}`;
      }
    }
  }
  return null;
}

/** Count slots in the next 7 days (for performance tips). */
export function countSlotsNextWeek(slots: TrainerScheduleDay[]): number {
  const now = Date.now();
  const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
  let n = 0;
  for (const day of slots) {
    const dayStr = String(day.day ?? "");
    if (!dayStr || !Array.isArray(day.slots)) continue;
    for (const slot of day.slots) {
      const start = String(slot.start_time ?? "");
      if (!start) continue;
      const iso = dayStr.includes("T") ? dayStr : `${dayStr}T${start}`;
      const ms = new Date(iso).getTime();
      if (Number.isFinite(ms) && ms >= now && ms <= weekEnd) n += 1;
    }
  }
  return n;
}

export function hasThursdaySlot(slots: TrainerScheduleDay[]): boolean {
  for (const day of slots) {
    const dayStr = String(day.day ?? "").toLowerCase();
    if (dayStr.includes("thu")) return (day.slots?.length ?? 0) > 0;
    const ms = new Date(dayStr).getTime();
    if (Number.isFinite(ms) && new Date(ms).getDay() === 4) {
      return (day.slots?.length ?? 0) > 0;
    }
  }
  return false;
}
