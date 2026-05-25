/**
 * Profile-completion scoring.
 *
 * Surfaces a "X% complete" pill on the dashboard with one-tap nudges to
 * each missing field. Trainees and trainers have different field sets
 * (a trainer's profile must include sport, hourly rate, bio etc. for
 * trainees to even find them in browse).
 *
 * Each step contributes its own weight so we can highlight critical gaps
 * (no profile picture, no sport) ahead of cosmetic ones (no bio).
 *
 * Returns:
 *   - `score`        — 0..100 integer
 *   - `missingSteps` — ordered list of nudges to surface
 *   - `nextStep`     — the highest-impact remaining nudge
 */

import { AccountType, type AccountTypeValue } from "../../constants/accountType";

export type ProfileCompletionStepId =
  | "profile_picture"
  | "full_name"
  | "bio"
  | "phone"
  | "timezone"
  | "language"
  | "sport"
  | "hourly_rate"
  | "certifications"
  | "availability"
  | "favorite_sport"
  | "interests";

export type ProfileCompletionStep = {
  id: ProfileCompletionStepId;
  label: string;
  hint: string;
  icon: string;
  weight: number;
  done: boolean;
  /** What screen / action the "Complete" CTA should open. */
  cta: ProfileCompletionAction;
};

export type ProfileCompletionAction =
  | { kind: "shell"; surfaceId: "editProfile" | "professionalProfile" | "trainerSchedule" | "settings" }
  | { kind: "feature"; featureId: "book-lesson" }
  | { kind: "settings-section"; section: "regional" };

export type ProfileCompletion = {
  score: number;
  steps: ProfileCompletionStep[];
  missingSteps: ProfileCompletionStep[];
  nextStep: ProfileCompletionStep | null;
};

function isNonEmptyString(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function isNonEmptyArray(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

export function computeProfileCompletion(
  user: Record<string, unknown> | null | undefined,
  /**
   * Accepts the broader `string` so callers can pass `useAuth().accountType`
   * directly without re-narrowing. Comparisons below tolerate any string
   * value and just fall through if neither role matches.
   */
  accountType: AccountTypeValue | string | null | undefined
): ProfileCompletion {
  const u = (user ?? {}) as Record<string, unknown>;
  const isTrainer = accountType === AccountType.TRAINER;
  const isTrainee = accountType === AccountType.TRAINEE;

  const baseSteps: ProfileCompletionStep[] = [
    {
      id: "profile_picture",
      label: "Add a profile picture",
      hint: "Profiles with photos get 3× more bookings.",
      icon: "person-circle-outline",
      weight: 18,
      done: isNonEmptyString(u.profile_picture),
      cta: { kind: "shell", surfaceId: "editProfile" },
    },
    {
      id: "full_name",
      label: "Confirm your name",
      hint: "Make sure your full name is set so others recognise you.",
      icon: "id-card-outline",
      weight: 6,
      done: isNonEmptyString(u.fullname) || isNonEmptyString(u.fullName),
      cta: { kind: "shell", surfaceId: "editProfile" },
    },
    {
      id: "bio",
      label: isTrainer ? "Write a coaching bio" : "Tell us about you",
      hint: isTrainer
        ? "A short bio helps trainees understand your style before booking."
        : "Trainers love seeing a sentence about your goals.",
      icon: "document-text-outline",
      weight: isTrainer ? 12 : 8,
      done: isNonEmptyString(u.bio),
      cta: { kind: "shell", surfaceId: "editProfile" },
    },
    {
      id: "phone",
      label: "Verify your phone",
      hint: "Helps us reach you for booking confirmations and OTP.",
      icon: "call-outline",
      weight: 8,
      done: isNonEmptyString(u.mobile_no) || isNonEmptyString(u.mobile),
      cta: { kind: "shell", surfaceId: "editProfile" },
    },
    {
      id: "timezone",
      label: "Set your timezone",
      hint: "We use this to show every session in your local time.",
      icon: "globe-outline",
      weight: 6,
      done: isNonEmptyString(u.time_zone),
      cta: { kind: "settings-section", section: "regional" },
    },
    {
      id: "language",
      label: "Pick your app language",
      hint: "Switch between English, Hindi, Spanish and more.",
      icon: "language-outline",
      weight: 4,
      done: isNonEmptyString(u.preferred_locale),
      cta: { kind: "settings-section", section: "regional" },
    },
  ];

  const trainerSteps: ProfileCompletionStep[] = [
    {
      id: "sport",
      label: "Pick your primary sport",
      hint: "Trainees filter by sport when browsing — this unlocks discovery.",
      icon: "tennisball-outline",
      weight: 16,
      done: isNonEmptyString(u.category) || isNonEmptyArray((u as { categories?: unknown }).categories),
      cta: { kind: "shell", surfaceId: "editProfile" },
    },
    {
      id: "hourly_rate",
      label: "Set your hourly rate",
      hint: "Required before you can accept paid bookings.",
      icon: "pricetag-outline",
      weight: 14,
      done:
        isNonEmptyString(u.hourly_rate) ||
        (typeof u.hourly_rate === "number" && (u.hourly_rate as number) > 0),
      cta: { kind: "shell", surfaceId: "editProfile" },
    },
    {
      id: "certifications",
      label: "Add a certification or credential",
      hint: "Verified credentials build trust and unlock the badge sooner.",
      icon: "ribbon-outline",
      weight: 10,
      done: isNonEmptyArray(
        (u as { certifications?: unknown }).certifications ??
          (u as { extraInfo?: { certifications?: unknown } }).extraInfo?.certifications
      ),
      cta: { kind: "shell", surfaceId: "professionalProfile" },
    },
    {
      id: "availability",
      label: "Publish your weekly availability",
      hint: "Empty calendars mean zero bookings. Add at least one slot.",
      icon: "calendar-outline",
      weight: 14,
      done: isNonEmptyArray((u as { slots?: unknown }).slots),
      cta: { kind: "shell", surfaceId: "trainerSchedule" },
    },
  ];

  const traineeSteps: ProfileCompletionStep[] = [
    {
      id: "favorite_sport",
      label: "Tell us your sport",
      hint: "We use this to recommend trainers and clips.",
      icon: "trophy-outline",
      weight: 14,
      done:
        isNonEmptyString((u as { sport?: unknown }).sport) ||
        isNonEmptyString(u.category) ||
        isNonEmptyArray((u as { interests?: unknown }).interests),
      cta: { kind: "shell", surfaceId: "editProfile" },
    },
    {
      id: "interests",
      label: "Favourite a few trainers",
      hint: "Save coaches you like — they appear instantly on your home.",
      icon: "heart-outline",
      weight: 8,
      done: isNonEmptyArray((u as { favorite_trainers?: unknown }).favorite_trainers),
      cta: { kind: "feature", featureId: "book-lesson" },
    },
  ];

  const steps = [
    ...baseSteps,
    ...(isTrainer ? trainerSteps : []),
    ...(isTrainee ? traineeSteps : []),
  ];

  const totalWeight = steps.reduce((sum, s) => sum + s.weight, 0) || 1;
  const earned = steps.reduce((sum, s) => sum + (s.done ? s.weight : 0), 0);
  const score = Math.round((earned / totalWeight) * 100);

  /** Sort missing by weight desc so the dashboard pill prompts the most
   *  impactful gap first. Ties keep insertion order so the trainer-only
   *  must-haves (sport, rate, availability) outrank cosmetic items. */
  const missingSteps = steps.filter((s) => !s.done).sort((a, b) => b.weight - a.weight);

  return {
    score,
    steps,
    missingSteps,
    nextStep: missingSteps[0] ?? null,
  };
}
