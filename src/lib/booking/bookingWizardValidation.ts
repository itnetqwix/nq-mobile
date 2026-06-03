/**
 * Pure validation for booking wizards — matrix B2, B6, B7.
 */

export const INSTANT_ALLOWED_MINUTES = [15, 30] as const;

export function isInstantDurationAllowed(minutes: number): boolean {
  return (INSTANT_ALLOWED_MINUTES as readonly number[]).includes(minutes);
}

/** Scheduled slot must be strictly in the future (local comparison). */
export function isScheduledSlotInPast(
  slotStart: Date,
  now: Date = new Date()
): boolean {
  return slotStart.getTime() <= now.getTime();
}

/** Trainer dashboard popup: scheduled pending only, never instant. */
export function shouldOpenTrainerScheduledBookingPopup(
  session: { is_instant?: boolean } | null | undefined,
  isPendingForDashboard: boolean
): boolean {
  if (!isPendingForDashboard) return false;
  if (session?.is_instant === true) return false;
  return true;
}
