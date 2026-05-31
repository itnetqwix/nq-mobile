export const SCHEDULED_DURATIONS = [15, 30, 45, 60, 75, 90] as const;

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
