import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Tiny AsyncStorage wrapper for everything we want to keep around for a
 * signed-out user (favorites they hearted, trainers they viewed, search
 * terms, nudge cooldowns, etc.). All keys live under the same prefix so
 * we can wipe them in one shot after the user signs in and we've replayed
 * the data server-side.
 */

const PREFIX = "nq.guest.";

export const GUEST_STORAGE_KEYS = {
  favoriteTrainers: `${PREFIX}favoriteTrainers`,
  recentlyViewedTrainers: `${PREFIX}recentlyViewedTrainers`,
  recentSearches: `${PREFIX}recentSearches`,
  activityEvents: `${PREFIX}activityEvents`,
  nudgeState: `${PREFIX}nudgeState`,
} as const;

export type GuestStorageKey =
  (typeof GUEST_STORAGE_KEYS)[keyof typeof GUEST_STORAGE_KEYS];

export async function readGuestJson<T>(key: GuestStorageKey, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeGuestJson<T>(key: GuestStorageKey, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — best effort only */
  }
}

export async function clearGuestJson(key: GuestStorageKey): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Wipes everything we saved while the user was a guest. Call this after a
 * successful sign-in / replay so we don't keep stale lookalike state.
 */
export async function clearAllGuestData(): Promise<void> {
  await Promise.all(
    Object.values(GUEST_STORAGE_KEYS).map((k) => clearGuestJson(k))
  );
}

/** Trim an array to its newest N items by timestamp `t`. */
export function trimByTimestamp<T extends { t?: number }>(arr: T[], max: number): T[] {
  return [...arr]
    .sort((a, b) => (b.t ?? 0) - (a.t ?? 0))
    .slice(0, max);
}
