import type { WizardStep } from "./types";

/** Instant lessons: 15 and 30 minutes only. */
export const INSTANT_LESSON_DURATIONS = [
  { label: "15 Minutes", minutes: 15 },
  { label: "30 Minutes", minutes: 30 },
] as const;

export const MAX_CLIPS = 2;

export const WIZARD_STEPS: readonly WizardStep[] = ["duration", "clips", "confirm"];

export function wizardStepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}
