import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS } from "../../../constants/storageKeys";

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
}

export async function getAccountType(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.ACC_TYPE);
}

export async function saveSession(accessToken: string, accountType: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(STORAGE_KEYS.ACC_TYPE, accountType);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.ACC_TYPE);
}
