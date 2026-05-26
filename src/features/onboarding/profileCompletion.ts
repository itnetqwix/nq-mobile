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

/**
 * Backend writes some trainer fields under `extraInfo.*` (signup default in
 * `authService.ts`: `extraInfo.hourly_rate`, `extraInfo.bio`,
 * `extraInfo.availabilityInfo.availability`). Other places update the top-level
 * field. We therefore probe BOTH locations from this helper so the completion
 * pill flips to "done" regardless of which writer touched the doc last.
 *
 * `paths` are dot-delimited; each segment is looked up as a plain property.
 */
function readPath(u: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = u;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function anyNonEmptyString(u: Record<string, unknown>, paths: string[]): boolean {
  return paths.some((p) => isNonEmptyString(readPath(u, p)));
}

function anyNonEmptyArray(u: Record<string, unknown>, paths: string[]): boolean {
  return paths.some((p) => isNonEmptyArray(readPath(u, p)));
}

/**
 * Hourly-rate detection. Accepts:
 *  - number > 0 (top-level or `extraInfo.hourly_rate` — both observed in db)
 *  - numeric-castable non-empty string ("20", "1500.50")
 *  - rejects "" / "0" / null
 */
function hasMeaningfulRate(u: Record<string, unknown>): boolean {
  const candidates: unknown[] = [
    readPath(u, "hourly_rate"),
    readPath(u, "hourlyRate"),
    readPath(u, "extraInfo.hourly_rate"),
    readPath(u, "extraInfo.hourlyRate"),
    readPath(u, "pricing.hourlyRate"),
    readPath(u, "pricing.hourly_rate"),
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c) && c > 0) return true;
    if (typeof c === "string" && c.trim().length > 0) {
      const n = Number(c.trim());
      if (Number.isFinite(n) && n > 0) return true;
    }
  }
  return false;
}

/**
 * Trainer weekly availability detection. Backend signup defaults populate
 * `extraInfo.availabilityInfo.availability` as a `{ Mon: [...], Tue: [...] }`
 * object, while the trainer-schedule painter may write a top-level `slots`
 * array. Either one is enough to flip "done".
 */
function hasPublishedAvailability(u: Record<string, unknown>): boolean {
  if (anyNonEmptyArray(u, ["slots", "availability", "extraInfo.slots"])) {
    return true;
  }
  const availability = readPath(u, "extraInfo.availabilityInfo.availability");
  if (availability && typeof availability === "object") {
    for (const v of Object.values(availability as Record<string, unknown>)) {
      if (Array.isArray(v) && v.length > 0) return true;
    }
  }
  return false;
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
      done: anyNonEmptyString(u, [
        "profile_picture",
        "profilePicture",
        "avatar",
      ]),
      cta: { kind: "shell", surfaceId: "editProfile" },
    },
    {
      id: "full_name",
      label: "Confirm your name",
      hint: "Make sure your full name is set so others recognise you.",
      icon: "id-card-outline",
      weight: 6,
      done: anyNonEmptyString(u, ["fullname", "fullName", "name"]),
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
      done: anyNonEmptyString(u, [
        "bio",
        "about",
        "extraInfo.bio",
        "extraInfo.about",
      ]),
      cta: { kind: "shell", surfaceId: "editProfile" },
    },
    {
      id: "phone",
      label: "Verify your phone",
      hint: "Helps us reach you for booking confirmations and OTP.",
      icon: "call-outline",
      weight: 8,
      done: anyNonEmptyString(u, [
        "mobile_no",
        "mobile",
        "phone",
        "phoneNumber",
      ]),
      cta: { kind: "shell", surfaceId: "editProfile" },
    },
    {
      id: "timezone",
      label: "Set your timezone",
      hint: "We use this to show every session in your local time.",
      icon: "globe-outline",
      weight: 6,
      done: anyNonEmptyString(u, [
        "time_zone",
        "timeZone",
        "timezone",
        "extraInfo.availabilityInfo.timeZone",
      ]),
      cta: { kind: "settings-section", section: "regional" },
    },
    {
      id: "language",
      label: "Pick your app language",
      hint: "Switch between English, Hindi, Spanish and more.",
      icon: "language-outline",
      weight: 4,
      done: anyNonEmptyString(u, [
        "preferred_locale",
        "preferredLocale",
        "locale",
      ]),
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
      done:
        anyNonEmptyString(u, ["category", "extraInfo.category"]) ||
        anyNonEmptyArray(u, [
          "categories",
          "categoryList",
          "extraInfo.categories",
        ]),
      cta: { kind: "shell", surfaceId: "editProfile" },
    },
    {
      id: "hourly_rate",
      label: "Set your hourly rate",
      hint: "Required before you can accept paid bookings.",
      icon: "pricetag-outline",
      weight: 14,
      done: hasMeaningfulRate(u),
      cta: { kind: "shell", surfaceId: "editProfile" },
    },
    {
      id: "certifications",
      label: "Add a certification or credential",
      hint: "Verified credentials build trust and unlock the badge sooner.",
      icon: "ribbon-outline",
      weight: 10,
      done: anyNonEmptyArray(u, [
        "certifications",
        "certificates",
        "extraInfo.certifications",
        "extraInfo.certificates",
      ]),
      cta: { kind: "shell", surfaceId: "professionalProfile" },
    },
    {
      id: "availability",
      label: "Publish your weekly availability",
      hint: "Empty calendars mean zero bookings. Add at least one slot.",
      icon: "calendar-outline",
      weight: 14,
      done: hasPublishedAvailability(u),
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
        anyNonEmptyString(u, ["sport", "category", "extraInfo.sport"]) ||
        anyNonEmptyArray(u, ["interests", "categories"]),
      cta: { kind: "shell", surfaceId: "editProfile" },
    },
    {
      id: "interests",
      label: "Favourite a few trainers",
      hint: "Save coaches you like — they appear instantly on your home.",
      icon: "heart-outline",
      weight: 8,
      done: anyNonEmptyArray(u, [
        "favorite_trainers",
        "favoriteTrainers",
        "favourites",
      ]),
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
