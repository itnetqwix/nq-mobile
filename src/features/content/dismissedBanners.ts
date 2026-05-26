/**
 * Tracks which admin banners the user has dismissed locally. The backend
 * deliberately doesn't store per-user dismissals; we just remember them on
 * the device under a single AsyncStorage key.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@nq/dismissed-banners/v1";
let cache: Set<string> | null = null;
const listeners = new Set<() => void>();

async function ensureLoaded(): Promise<Set<string>> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    cache = new Set<string>();
  }
  return cache;
}

async function persist(): Promise<void> {
  if (!cache) return;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(Array.from(cache)));
  } catch {
    /* ignore */
  }
}

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

export const dismissedBanners = {
  async list(): Promise<string[]> {
    const set = await ensureLoaded();
    return Array.from(set);
  },
  async dismiss(id: string): Promise<void> {
    const set = await ensureLoaded();
    if (!id || set.has(id)) return;
    set.add(id);
    await persist();
    notify();
  },
  async clear(): Promise<void> {
    cache = new Set<string>();
    await AsyncStorage.removeItem(KEY).catch(() => {});
    notify();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
