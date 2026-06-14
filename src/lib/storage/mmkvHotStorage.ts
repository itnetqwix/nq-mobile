/**
 * Fast key-value storage for hot paths (query cache, offline queues).
 * Theme/prefs stay on AsyncStorage — MMKV is sync and much faster on cold start.
 */
import { createMMKV } from "react-native-mmkv";

const store = createMMKV({ id: "nq-hot-storage" });

export const mmkvHotStorage = {
  getString(key: string): string | undefined {
    return store.getString(key);
  },
  set(key: string, value: string): void {
    store.set(key, value);
  },
  delete(key: string): void {
    store.delete(key);
  },
};

/** AsyncStorage-compatible adapter for TanStack Query persister. */
export const mmkvAsyncStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    return mmkvHotStorage.getString(key) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    mmkvHotStorage.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    mmkvHotStorage.delete(key);
  },
};

export async function readJsonFromMmkv<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = mmkvHotStorage.getString(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonToMmkv(key: string, value: unknown): Promise<void> {
  mmkvHotStorage.set(key, JSON.stringify(value));
}
