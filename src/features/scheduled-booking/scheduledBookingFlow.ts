import { DateTime } from "luxon";
import { SCHEDULED_DURATIONS } from "./constants";
import { buildStartCandidates, type SlotWindow } from "./timeSlotUtils";

/** Durations that fit the selected start inside open windows (incl. buffer + lead time). */
export function pickAvailableDurations(
  slotWindows: SlotWindow[],
  selectedStartIso: string | null,
  zone: string,
  now?: DateTime
): number[] {
  if (!selectedStartIso) return [...SCHEDULED_DURATIONS];
  const anchor = now ?? DateTime.now().setZone(zone);
  return SCHEDULED_DURATIONS.filter((min) =>
    buildStartCandidates(slotWindows, min, 15, { now: anchor }).some(
      (c) => c.toISO() === selectedStartIso
    )
  );
}

export function isSlotConflictMessage(message: string): boolean {
  return /no longer available|unavailable|outside the trainer|at least \d+ minutes from now/i.test(
    message
  );
}
