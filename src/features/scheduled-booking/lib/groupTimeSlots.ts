import type { DateTime } from "luxon";

export type TimeOfDayGroup = "morning" | "afternoon" | "evening";

export type GroupedTimeSlots = Record<TimeOfDayGroup, DateTime[]>;

/** Group availability slots into morning / afternoon / evening for scannable pickers. */
export function groupTimeSlotsByPeriod(slots: DateTime[]): GroupedTimeSlots {
  const groups: GroupedTimeSlots = { morning: [], afternoon: [], evening: [] };
  for (const dt of slots) {
    const hour = dt.hour;
    if (hour < 12) groups.morning.push(dt);
    else if (hour < 17) groups.afternoon.push(dt);
    else groups.evening.push(dt);
  }
  return groups;
}

export const TIME_OF_DAY_ORDER: TimeOfDayGroup[] = ["morning", "afternoon", "evening"];
