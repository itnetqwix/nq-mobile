import { useQueries } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { useMemo } from "react";
import { queryKeys } from "../../../lib/queryKeys";
import { SCHEDULE_BOOKING_HORIZON_DAYS } from "../constants";
import { fetchDayAvailability } from "../scheduledBookingApi";
import {
  buildCalendarMonthGrid,
  countStartCandidatesForDay,
  type CalendarMonthCell,
} from "../timeSlotUtils";

export type DayAvailabilityState = "disabled" | "loading" | "none" | "available";

export function useMonthAvailabilityMap(params: {
  trainerId: string | undefined;
  traineeTz: string;
  month: DateTime;
  durationMinutes: number;
  enabled: boolean;
  horizonDays?: number;
}) {
  const {
    trainerId,
    traineeTz,
    month,
    durationMinutes,
    enabled,
    horizonDays = SCHEDULE_BOOKING_HORIZON_DAYS,
  } = params;

  const { weeks, bookableDays } = useMemo(
    () => buildCalendarMonthGrid(month, traineeTz, horizonDays),
    [month, traineeTz, horizonDays]
  );

  const dayQueries = useQueries({
    queries: bookableDays.map((bookedDateIso) => ({
      queryKey: queryKeys.scheduled.checkSlot(trainerId ?? "", bookedDateIso, traineeTz),
      queryFn: () =>
        fetchDayAvailability({
          trainerId: trainerId!,
          bookedDateIso,
          traineeTimeZone: traineeTz,
        }),
      enabled: enabled && !!trainerId,
      staleTime: 120_000,
    })),
  });

  const dayStateByIso = useMemo(() => {
    const map = new Map<string, { state: DayAvailabilityState; slotCount: number }>();
    const bookableIndex = new Map(bookableDays.map((iso, i) => [iso, i]));

    for (const week of weeks) {
      for (const cell of week) {
        if (!cell.inMonth) continue;
        if (!cell.isBookable) {
          map.set(cell.iso, { state: "disabled", slotCount: 0 });
          continue;
        }
        const idx = bookableIndex.get(cell.iso);
        const query = idx == null ? undefined : dayQueries[idx];
        if (!query || query.isLoading || query.isFetching) {
          map.set(cell.iso, { state: "loading", slotCount: 0 });
          continue;
        }
        const slots = query.data?.availableSlots ?? [];
        const slotCount =
          query.data?.isAvailable === false || slots.length === 0
            ? 0
            : countStartCandidatesForDay(slots, cell.iso, traineeTz, durationMinutes);
        map.set(cell.iso, {
          state: slotCount > 0 ? "available" : "none",
          slotCount,
        });
      }
    }
    return map;
  }, [weeks, bookableDays, dayQueries, durationMinutes, traineeTz]);

  const getDayState = (cell: CalendarMonthCell) =>
    dayStateByIso.get(cell.iso) ?? { state: "disabled" as const, slotCount: 0 };

  const monthHasAvailability = useMemo(() => {
    for (const [, v] of dayStateByIso) {
      if (v.state === "available") return true;
    }
    return false;
  }, [dayStateByIso]);

  const isMonthLoading = dayQueries.some((q) => q.isLoading || q.isFetching);

  return {
    weeks,
    getDayState,
    monthHasAvailability,
    isMonthLoading,
    bookableDays,
  };
}
