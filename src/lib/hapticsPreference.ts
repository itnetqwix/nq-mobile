import {
  hydrateHotStorageFallback,
  mmkvHotStorage,
} from "./storage/mmkvHotStorage";

const HAPTICS_ENABLED_KEY = "prefs:haptics_enabled";

/** Read persisted haptics preference (defaults to enabled). */
export function readHapticsEnabledFromStorage(): boolean {
  const raw = mmkvHotStorage.getString(HAPTICS_ENABLED_KEY);
  return raw === undefined ? true : raw === "1";
}

export function writeHapticsEnabledToStorage(enabled: boolean): void {
  mmkvHotStorage.set(HAPTICS_ENABLED_KEY, enabled ? "1" : "0");
}

/** Load MMKV fallback cache, then apply stored preference to the in-memory haptics gate. */
export async function hydrateHapticsPreference(
  apply: (enabled: boolean) => void
): Promise<boolean> {
  await hydrateHotStorageFallback();
  const enabled = readHapticsEnabledFromStorage();
  apply(enabled);
  return enabled;
}
