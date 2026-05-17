import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS } from "../../../constants/storageKeys";

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
}

export async function getSessionId(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.SESSION_ID);
}

export async function getAccountType(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.ACC_TYPE);
}

export async function saveSession(
  accessToken: string,
  accountType: string,
  extras?: { refreshToken?: string; sessionId?: string }
): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(STORAGE_KEYS.ACC_TYPE, accountType);
  if (extras?.refreshToken) {
    await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, extras.refreshToken);
  }
  if (extras?.sessionId) {
    await SecureStore.setItemAsync(STORAGE_KEYS.SESSION_ID, extras.sessionId);
  }
}

export async function clearSession(): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(STORAGE_KEYS.ACC_TYPE),
    SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
    SecureStore.deleteItemAsync(STORAGE_KEYS.SESSION_ID),
  ]);
}
