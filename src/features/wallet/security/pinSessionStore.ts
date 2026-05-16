import * as SecureStore from "expo-secure-store";

const PIN_TOKEN_KEY = "nq.wallet.pin.session";
const PIN_EXPIRES_KEY = "nq.wallet.pin.expires";

const SESSION_MS = 15 * 60 * 1000;

export async function savePinSession(token: string): Promise<void> {
  const expires = String(Date.now() + SESSION_MS);
  await SecureStore.setItemAsync(PIN_TOKEN_KEY, token);
  await SecureStore.setItemAsync(PIN_EXPIRES_KEY, expires);
}

export async function getPinSessionToken(): Promise<string | null> {
  const expires = await SecureStore.getItemAsync(PIN_EXPIRES_KEY);
  if (!expires || Date.now() > Number(expires)) {
    await clearPinSession();
    return null;
  }
  return SecureStore.getItemAsync(PIN_TOKEN_KEY);
}

export async function clearPinSession(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_TOKEN_KEY);
  await SecureStore.deleteItemAsync(PIN_EXPIRES_KEY);
}

export async function isPinSessionValid(): Promise<boolean> {
  const token = await getPinSessionToken();
  return !!token;
}
