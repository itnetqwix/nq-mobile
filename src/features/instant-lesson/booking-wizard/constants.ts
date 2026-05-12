import type { WizardStep } from "./types";

/** Same duration grid as web `InstantLessonTimeLine.jsx` → `InstantLessons`. */
export const INSTANT_LESSON_DURATIONS = [
  { label: "15 Minutes", minutes: 15 },
  { label: "30 Minutes", minutes: 30 },
  { label: "60 Minutes", minutes: 60 },
  { label: "2 Hours", minutes: 120 },
] as const;

export const MAX_CLIPS = 2;

export const WIZARD_STEPS: readonly WizardStep[] = ["intro", "duration", "clips", "confirm"];

export function wizardStepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}
