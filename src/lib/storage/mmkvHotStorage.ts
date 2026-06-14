/**
 * Fast key-value storage for hot paths (query cache, offline queues).
 * Uses native MMKV when the dev/production binary includes NitroModules;
 * falls back to AsyncStorage + in-memory cache on older builds / Expo Go.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

type HotStore = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
};

const FALLBACK_PREFIX = "nq-hot:";

let store: HotStore | null = null;
let usingNativeMmkv = false;
let fallbackHydrated = false;
let fallbackHydration: Promise<void> | null = null;
let loggedFallbackWarning = false;

function createAsyncStorageBackedStore(): HotStore {
  const cache = new Map<string, string>();
  return {
    getString(key: string) {
      return cache.get(key);
    },
    set(key: string, value: string) {
      cache.set(key, value);
      void AsyncStorage.setItem(`${FALLBACK_PREFIX}${key}`, value);
    },
    delete(key: string) {
      cache.delete(key);
      void AsyncStorage.removeItem(`${FALLBACK_PREFIX}${key}`);
    },
    // @ts-expect-error internal — used only by hydrateHotStorageFallback
    __cache: cache,
  };
}

/** Probe TurboModule registry without throwing or loading react-native-mmkv. */
function isNitroModulesLinked(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TurboModuleRegistry } = require("react-native") as typeof import("react-native");
    return TurboModuleRegistry.get("NitroModules") != null;
  } catch {
    return false;
  }
}

function tryCreateNativeMmkvStore(): HotStore | null {
  if (!isNitroModulesLinked()) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mmkvModule = require("react-native-mmkv") as typeof import("react-native-mmkv");
    const createMMKV = mmkvModule?.createMMKV;
    if (typeof createMMKV !== "function") return null;

    const mmkv = createMMKV({ id: "nq-hot-storage" });
    return {
      getString(key: string) {
        return mmkv.getString(key);
      },
      set(key: string, value: string) {
        mmkv.set(key, value);
      },
      delete(key: string) {
        mmkv.delete(key);
      },
    };
  } catch {
    return null;
  }
}

function logFallbackWarningOnce(): void {
  if (!__DEV__ || loggedFallbackWarning) return;
  loggedFallbackWarning = true;
  console.warn(
    "[mmkvHotStorage] Native MMKV is not in this app build — using AsyncStorage. " +
      "Run `npx expo run:android` (or `npm run android:rebuild-dev`) and reinstall the dev client."
  );
}

function getStore(): HotStore {
  if (store) return store;

  const native = tryCreateNativeMmkvStore();
  if (native) {
    usingNativeMmkv = true;
    store = native;
    return store;
  }

  usingNativeMmkv = false;
  logFallbackWarningOnce();
  store = createAsyncStorageBackedStore();
  return store;
}

/** Load persisted fallback keys before first read (no-op when native MMKV is active). */
export async function hydrateHotStorageFallback(): Promise<void> {
  getStore();
  if (usingNativeMmkv || fallbackHydrated) return;
  if (fallbackHydration) return fallbackHydration;

  fallbackHydration = (async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const hotKeys = keys.filter((k) => k.startsWith(FALLBACK_PREFIX));
      if (hotKeys.length === 0) {
        fallbackHydrated = true;
        return;
      }
      const pairs = await AsyncStorage.multiGet(hotKeys);
      const cache = (store as HotStore & { __cache?: Map<string, string> }).__cache;
      if (cache) {
        for (const [fullKey, value] of pairs) {
          if (value != null) {
            cache.set(fullKey.slice(FALLBACK_PREFIX.length), value);
          }
        }
      }
    } catch {
      /* non-blocking */
    } finally {
      fallbackHydrated = true;
    }
  })();

  return fallbackHydration;
}

export function isNativeMmkvAvailable(): boolean {
  getStore();
  return usingNativeMmkv;
}

export const mmkvHotStorage = {
  getString(key: string): string | undefined {
    return getStore().getString(key);
  },
  set(key: string, value: string): void {
    getStore().set(key, value);
  },
  delete(key: string): void {
    getStore().delete(key);
  },
};

/** AsyncStorage-compatible adapter for TanStack Query persister. */
export const mmkvAsyncStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    await hydrateHotStorageFallback();
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
    await hydrateHotStorageFallback();
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
