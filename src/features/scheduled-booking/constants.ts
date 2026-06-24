export const SCHEDULED_DURATIONS = [15, 30, 45, 60, 75, 90] as const;

/** Gap required between back-to-back sessions (matches backend). */
export const SCHEDULED_BOOKING_BUFFER_MINUTES = 15;
/** Earliest bookable start from now — 2 hours (matches backend). */
export const SCHEDULED_MIN_LEAD_TIME_MINUTES = 120;
/** Soft hold while completing payment (matches backend). */
export const SCHEDULED_SLOT_HOLD_MINUTES = 10;

export type ScheduledDurationMinutes = (typeof SCHEDULED_DURATIONS)[number];

export const SCHEDULED_WIZARD_STEPS = [
  "datetime",
  "duration",
  "clips",
  "promo",
  "payment",
  "confirm",
] as const;

export type ScheduledWizardStep = (typeof SCHEDULED_WIZARD_STEPS)[number];

export function scheduledStepIndex(step: ScheduledWizardStep): number {
  return SCHEDULED_WIZARD_STEPS.indexOf(step);
}
