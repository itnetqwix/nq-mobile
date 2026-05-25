/**
 * Persistent "seen" set for coach marks.
 *
 * Keys are scoped per-user so a shared device doesn't leak hints to the
 * wrong account. `expo-secure-store` restricts characters to `[A-Za-z0-9._-]`
 * so we sanitise free-form ids before persisting.
 */

import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "nq.coach-marks.seen.v1";

function sanitise(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, "-");
}

type SeenMap = Record<string, true>;

let cache: SeenMap | null = null;
let cachePromise: Promise<SeenMap> | null = null;

async function load(): Promise<SeenMap> {
  if (cache) return cache;
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (!raw) {
        cache = {};
        return cache;
      }
      cache = JSON.parse(raw) as SeenMap;
      return cache;
    } catch {
      cache = {};
      return cache;
    } finally {
      cachePromise = null;
    }
  })();
  return cachePromise;
}

async function flush(): Promise<void> {
  if (!cache) return;
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /** Non-critical persistence — the in-memory cache still suppresses
     *  repeats within this session even if disk write fails. */
  }
}

export async function hasSeenCoachMark(id: string): Promise<boolean> {
  const map = await load();
  return !!map[sanitise(id)];
}

export async function markCoachMarkSeen(id: string): Promise<void> {
  const map = await load();
  map[sanitise(id)] = true;
  await flush();
}

/** Used by the "reset onboarding" debug action. */
export async function resetCoachMarks(): Promise<void> {
  cache = {};
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
