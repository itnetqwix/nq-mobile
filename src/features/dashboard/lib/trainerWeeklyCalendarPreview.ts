import { DateTime } from "luxon";
import { SCHEDULE_BOOKING_HORIZON_DAYS } from "../../scheduled-booking/constants";
import {
  buildCalendarMonthGrid,
  type CalendarMonthCell,
} from "../../scheduled-booking/timeSlotUtils";
import type { DayAvailabilityState } from "../../scheduled-booking/hooks/useMonthAvailabilityMap";

const LUXON_WEEKDAY_TO_KEY = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type WeeklySlotRow = {
  day?: string;
  slots?: Array<{ start_time?: string; end_time?: string }>;
};

function normDay(d: string): string {
  return String(d || "")
    .trim()
    .toLowerCase();
}

/** True when the trainer's weekly template has at least one range on this calendar day. */
export function weeklyInventoryHasSlotsOnDate(
  inventory: WeeklySlotRow[],
  isoDate: string,
  zone: string
): boolean {
  const dt = DateTime.fromISO(isoDate, { zone });
  if (!dt.isValid) return false;
  const dayKey = LUXON_WEEKDAY_TO_KEY[dt.weekday - 1];
  const row = inventory.find((d) => normDay(d.day ?? "") === dayKey);
  return (row?.slots?.length ?? 0) > 0;
}

export function buildTrainerMonthDayStateMap(params: {
  inventory: WeeklySlotRow[];
  month: DateTime;
  zone: string;
  horizonDays?: number;
}): {
  weeks: CalendarMonthCell[][];
  getDayState: (cell: CalendarMonthCell) => { state: DayAvailabilityState; slotCount: number };
} {
  const { inventory, month, zone, horizonDays = SCHEDULE_BOOKING_HORIZON_DAYS } = params;
  const { weeks } = buildCalendarMonthGrid(month, zone, horizonDays);

  const getDayState = (cell: CalendarMonthCell) => {
    if (!cell.isBookable) {
      return { state: "disabled" as const, slotCount: 0 };
    }
    const has = weeklyInventoryHasSlotsOnDate(inventory, cell.iso, zone);
    return {
      state: has ? ("available" as const) : ("none" as const),
      slotCount: has ? 1 : 0,
    };
  };

  return { weeks, getDayState };
}

export function slotsForWeekday(
  inventory: WeeklySlotRow[],
  isoDate: string,
  zone: string
): Array<{ start_time?: string; end_time?: string }> {
  const dt = DateTime.fromISO(isoDate, { zone });
  if (!dt.isValid) return [];
  const dayKey = LUXON_WEEKDAY_TO_KEY[dt.weekday - 1];
  const row = inventory.find((d) => normDay(d.day ?? "") === dayKey);
  return row?.slots ?? [];
}
