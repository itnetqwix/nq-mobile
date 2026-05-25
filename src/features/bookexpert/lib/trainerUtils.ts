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

export function getTrainerReviewCount(trainer: Record<string, unknown> | null | undefined): number {
  const n = Number(trainer?.reviewCount);
  if (Number.isFinite(n) && n >= 0) return n;
  const rows = trainer?.trainer_ratings;
  return Array.isArray(rows) ? rows.length : 0;
}

export function getTrainerCompletedSessionCount(
  trainer: Record<string, unknown> | null | undefined
): number {
  const n = Number(trainer?.completedSessionCount);
  if (Number.isFinite(n) && n >= 0) return n;
  const rows = trainer?.trainer_ratings;
  if (!Array.isArray(rows)) return 0;
  return rows.filter((row) => {
    const r = row as Record<string, unknown>;
    const status = String(r?.status ?? "").toLowerCase();
    return status === "completed" || status === "confirm" || status === "confirmed";
  }).length;
}

export function isTrainerVerified(trainer: Record<string, unknown> | null | undefined): boolean {
  if (trainer?.isVerified === true) return true;
  const status = String(trainer?.status ?? "").toLowerCase();
  if (status === "approved") return true;
  const tv = trainer?.trainer_verification as Record<string, unknown> | undefined;
  return String(tv?.onboarding_step ?? "") === "completed";
}

export function trainerHasOpenSlots(trainer: Record<string, unknown> | null | undefined): boolean {
  const slots = trainer?.slots;
  if (Array.isArray(slots) && slots.length > 0) return true;
  const avail = trainer?.available_slots;
  if (!Array.isArray(avail)) return false;
  return avail.some((day) => {
    const d = day as { slots?: unknown[] };
    return Array.isArray(d.slots) && d.slots.length > 0;
  });
}

export type NextSlotPreview = {
  label: string;
  time: string;
  iso: string;
};

const DAY_NAME_TO_NUM: Record<string, number> = {
  sun: 7, sunday: 7,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

function parseHHmm(value: unknown): { h: number; m: number } | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [hStr, mStr] = trimmed.split(":");
  const h = Number(hStr);
  const m = Number(mStr ?? "0");
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

/**
 * Returns up to `limit` upcoming bookable slots for a trainer, rendered as
 * short chips ("Mon 6:00 PM", "Wed 7:30 AM"). Pulled directly from the
 * trainer's weekly availability so we don't need an extra API call per
 * card — the directory payload already includes `extraInfo.availabilityInfo`.
 *
 * Slots that fall earlier today than "now" are skipped so cards never show
 * stale times. Timezone is the trainer's, with a sensible UTC fallback.
 */
export function getTrainerNextSlots(
  trainer: Record<string, unknown> | null | undefined,
  limit = 3
): NextSlotPreview[] {
  if (!trainer) return [];
  const extra = trainer.extraInfo as Record<string, unknown> | undefined;
  const avail = extra?.availabilityInfo as
    | { availability?: Record<string, unknown>; timeZone?: string }
    | undefined;
  const weekly = avail?.availability;
  if (!weekly || typeof weekly !== "object") return [];
  const tz =
    avail?.timeZone ||
    (trainer.time_zone as string | undefined) ||
    (trainer.trainer_timezone as string | undefined) ||
    "utc";

  const { DateTime } = require("luxon") as typeof import("luxon");
  const now = DateTime.now().setZone(tz);
  if (!now.isValid) return [];

  type Candidate = { start: import("luxon").DateTime };
  const candidates: Candidate[] = [];

  for (const [dayName, slotsRaw] of Object.entries(weekly)) {
    const dayKey = dayName.toLowerCase();
    const dayNum = DAY_NAME_TO_NUM[dayKey];
    if (!dayNum) continue;
    if (!Array.isArray(slotsRaw)) continue;

    for (const slot of slotsRaw) {
      const s = slot as { start_time?: unknown; end_time?: unknown };
      const start = parseHHmm(s.start_time);
      if (!start) continue;

      let day = now.set({ hour: start.h, minute: start.m, second: 0, millisecond: 0 });
      const offset = (dayNum - day.weekday + 7) % 7;
      day = day.plus({ days: offset });
      if (day <= now) day = day.plus({ days: 7 });
      candidates.push({ start: day });
    }
  }

  candidates.sort((a, b) => a.start.toMillis() - b.start.toMillis());

  const limited = candidates.slice(0, Math.max(0, limit));
  return limited.map((row) => ({
    label: row.start.toFormat("ccc"),
    time: row.start.toFormat("h:mm a"),
    iso: row.start.toUTC().toISO() ?? "",
  }));
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

export type TrainerCertificateRow = {
  id: string;
  title: string;
  issuer: string;
  issued_at?: string;
  expires_at?: string;
};

export type TrainerWorkRow = {
  id: string;
  title: string;
  company?: string;
  location: string;
  start_date: string;
  end_date?: string;
  is_current?: boolean;
  description?: string;
};

export type TrainerDegreeRow = {
  id: string;
  degree: string;
  field_of_study?: string;
  institution: string;
  location?: string;
  graduation_year?: string;
};

function asRecordArray(extra: Record<string, unknown> | undefined, key: string): Record<string, unknown>[] {
  const val = extra?.[key];
  return Array.isArray(val) ? val.filter((x) => x && typeof x === "object") as Record<string, unknown>[] : [];
}

export function getTrainerCertificates(
  trainer: Record<string, unknown> | null | undefined
): TrainerCertificateRow[] {
  const extra = trainer?.extraInfo as Record<string, unknown> | undefined;
  return asRecordArray(extra, "certificates")
    .map((row, i) => ({
      id: String(row.id ?? i),
      title: String(row.title ?? "").trim(),
      issuer: String(row.issuer ?? "").trim(),
      issued_at: row.issued_at ? String(row.issued_at) : undefined,
      expires_at: row.expires_at ? String(row.expires_at) : undefined,
    }))
    .filter((r) => r.title && r.issuer);
}

export function getTrainerWorkExperience(
  trainer: Record<string, unknown> | null | undefined
): TrainerWorkRow[] {
  const extra = trainer?.extraInfo as Record<string, unknown> | undefined;
  return asRecordArray(extra, "work_experience")
    .map((row, i) => ({
      id: String(row.id ?? i),
      title: String(row.title ?? "").trim(),
      company: row.company ? String(row.company).trim() : undefined,
      location: String(row.location ?? "").trim(),
      start_date: String(row.start_date ?? "").trim(),
      end_date: row.end_date ? String(row.end_date) : undefined,
      is_current: row.is_current === true,
      description: row.description ? String(row.description).trim() : undefined,
    }))
    .filter((r) => r.title && r.location && r.start_date);
}

export function getTrainerDegrees(
  trainer: Record<string, unknown> | null | undefined
): TrainerDegreeRow[] {
  const extra = trainer?.extraInfo as Record<string, unknown> | undefined;
  return asRecordArray(extra, "degrees")
    .map((row, i) => ({
      id: String(row.id ?? i),
      degree: String(row.degree ?? "").trim(),
      field_of_study: row.field_of_study ? String(row.field_of_study).trim() : undefined,
      institution: String(row.institution ?? "").trim(),
      location: row.location ? String(row.location).trim() : undefined,
      graduation_year: row.graduation_year ? String(row.graduation_year).trim() : undefined,
    }))
    .filter((r) => r.degree && r.institution);
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

export type TrainerFriendPeer = {
  _id: string;
  fullname?: string;
  profile_picture?: string;
};

function normalizeFriendPeers(raw: unknown): TrainerFriendPeer[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: TrainerFriendPeer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = String(row._id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      _id: id,
      fullname: row.fullname as string | undefined,
      profile_picture: row.profile_picture as string | undefined,
    });
    if (out.length >= 4) break;
  }
  return out;
}

export function getTrainerFriendsWhoFavorited(
  trainer: Record<string, unknown> | null | undefined
): TrainerFriendPeer[] {
  return normalizeFriendPeers(trainer?.friendsWhoFavorited);
}

export function getTrainerFriendsWhoBooked(
  trainer: Record<string, unknown> | null | undefined
): TrainerFriendPeer[] {
  return normalizeFriendPeers(trainer?.friendsWhoBooked);
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
