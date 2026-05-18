import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS } from "../constants/storageKeys";

export async function loadPersistedAppLocale(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.APP_LOCALE);
  } catch {
    return null;
  }
}

export async function persistAppLocale(code: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.APP_LOCALE, code);
  } catch {
    /* non-fatal */
  }
}
