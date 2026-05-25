import AsyncStorage from "@react-native-async-storage/async-storage";
import { getTrainerId, getTrainerName } from "../../bookexpert/lib/trainerUtils";

const PREFIX = "nq.recentlyViewedTrainers.";
const GUEST_KEY = `${PREFIX}guest`;
const MAX_ROWS = 12;
const DEDUPE_WINDOW_MS = 1000 * 60 * 10;

export type RecentTrainerRow = {
  _id: string;
  name: string;
  profile_picture?: string;
  hourly_rate?: number;
  avgRating?: number;
  category?: unknown;
  t: number;
};

/**
 * Recently-viewed-trainers cache. Works the same way for signed-in users and
 * guests — we just key by user id so different accounts on the same device
 * don't stomp on each other. Guests share one key; once they sign up the
 * guest activity replay carries the IDs server-side anyway.
 */

function keyFor(userId: string | null | undefined): string {
  if (!userId) return GUEST_KEY;
  return `${PREFIX}user.${userId}`;
}

function pickSnapshot(
  trainer: Record<string, unknown>,
  id: string
): RecentTrainerRow {
  return {
    _id: id,
    name: getTrainerName(trainer) || "Coach",
    profile_picture:
      (trainer.profile_picture as string | undefined) ??
      (trainer.avatar as string | undefined),
    hourly_rate: (trainer.hourly_rate as number | undefined) ?? undefined,
    avgRating:
      (trainer.avgRating as number | undefined) ??
      (trainer.rating as number | undefined),
    category: trainer.category ?? trainer.categories,
    t: Date.now(),
  };
}

async function readList(userId: string | null): Promise<RecentTrainerRow[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

async function writeList(
  userId: string | null,
  rows: RecentTrainerRow[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(rows));
  } catch {
    /* best effort */
  }
}

export async function recordRecentTrainer(
  trainer: Record<string, unknown> | null | undefined,
  userId: string | null
): Promise<void> {
  if (!trainer) return;
  const id = getTrainerId(trainer);
  if (!id) return;

  const existing = await readList(userId);
  const last = existing.find((r) => r._id === id);
  if (last && Date.now() - last.t < DEDUPE_WINDOW_MS) {
    return;
  }
  const snapshot = pickSnapshot(trainer, id);
  const next = [snapshot, ...existing.filter((r) => r._id !== id)].slice(
    0,
    MAX_ROWS
  );
  await writeList(userId, next);
}

export async function getRecentTrainers(
  userId: string | null
): Promise<RecentTrainerRow[]> {
  return readList(userId);
}

export async function clearRecentTrainers(
  userId: string | null
): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    /* ignore */
  }
}
