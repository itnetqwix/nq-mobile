export type TrainerReview = {
  id: string;
  traineeName: string;
  sessionRating: number;
  title?: string;
  remarks?: string;
  updatedAt?: string;
};

export function getTrainerId(trainer: Record<string, unknown> | null | undefined): string {
  return String(trainer?._id ?? trainer?.id ?? "");
}

export function getTrainerName(trainer: Record<string, unknown> | null | undefined): string {
  return (
    (trainer?.fullname as string) ||
    (trainer?.fullName as string) ||
    (trainer?.name as string) ||
    "Coach"
  );
}

/** User `category` is a string; some payloads use `categories` array. */
export function getTrainerCategories(trainer: Record<string, unknown> | null | undefined): string[] {
  const raw = trainer?.categories ?? trainer?.category;
  if (Array.isArray(raw)) {
    return raw.filter((c): c is string => typeof c === "string" && c.trim().length > 0);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(/[,•|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function getTrainerHourlyRate(trainer: Record<string, unknown> | null | undefined): number | null {
  const extra = trainer?.extraInfo as Record<string, unknown> | undefined;
  const raw = trainer?.hourly_rate ?? extra?.hourly_rate;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getTrainerAvgRating(trainer: Record<string, unknown> | null | undefined): number | null {
  const raw = trainer?.avgRating ?? trainer?.rating;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getTrainerBio(trainer: Record<string, unknown> | null | undefined): string {
  const extra = trainer?.extraInfo as Record<string, unknown> | undefined;
  const bio =
    (trainer?.bio as string) ||
    (extra?.bio as string) ||
    (extra?.about as string) ||
    "";
  return bio.trim();
}

export function getTrainerExtraSection(
  trainer: Record<string, unknown> | null | undefined,
  key: string
): string {
  const extra = trainer?.extraInfo as Record<string, unknown> | undefined;
  const val = extra?.[key];
  return typeof val === "string" ? val.trim() : "";
}

export function extractTrainerReviews(trainer: Record<string, unknown> | null | undefined): TrainerReview[] {
  const rows = trainer?.trainer_ratings;
  if (!Array.isArray(rows)) return [];

  const out: TrainerReview[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>;
    const ratings = row?.ratings as Record<string, unknown> | undefined;
    const trainee = ratings?.trainee as Record<string, unknown> | undefined;
    const score = Number(trainee?.sessionRating);
    if (!Number.isFinite(score) || score <= 0) continue;
    out.push({
      id: String(row?._id ?? i),
      traineeName:
        (trainee?.traineeFullname as string) ||
        (row?.trainee_fullname as string) ||
        "Trainee",
      sessionRating: score,
      title: (trainee?.title as string) || undefined,
      remarks: (trainee?.remarksInfo as string) || undefined,
      updatedAt: (row?.updatedAt as string) || undefined,
    });
  }
  return out.sort((a, b) => b.sessionRating - a.sessionRating);
}

export function groupCategoriesAlphabetically(categories: string[]): { title: string; data: string[] }[] {
  const groups: Record<string, string[]> = {};
  for (const c of categories) {
    const letter = (c[0] ?? "#").toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : "#";
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }
  return Object.keys(groups)
    .sort((a, b) => a.localeCompare(b))
    .map((title) => ({
      title,
      data: groups[title]!.sort((a, b) => a.localeCompare(b)),
    }));
}
