/**
 * Onboarding & first-run barrel.
 *
 *   import {
 *     CoachMarkProvider,
 *     CoachMark,
 *     ProfileCompletionPill,
 *     PreClassChecklistSheet,
 *   } from "@/features/onboarding";
 */

export { OnboardingWalkthrough } from "./OnboardingWalkthrough";
export {
  CoachMarkProvider,
  useCoachMarkContext,
  type CoachMarkAnchor,
  type CoachMarkPayload,
} from "./coachMarks/CoachMarkProvider";
export { CoachMark } from "./coachMarks/CoachMark";
export { CoachMarkOverlay } from "./coachMarks/CoachMarkOverlay";
export {
  hasSeenCoachMark,
  markCoachMarkSeen,
  resetCoachMarks,
} from "./coachMarks/storage";

export { ProfileCompletionPill } from "./components/ProfileCompletionPill";
export { PreClassChecklistSheet } from "./components/PreClassChecklistSheet";

export {
  computeProfileCompletion,
  type ProfileCompletion,
  type ProfileCompletionStep,
  type ProfileCompletionStepId,
  type ProfileCompletionAction,
} from "./profileCompletion";
