import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Remembers which sign-in path the user used most recently — Google, Apple,
 * password, or magic link — so we can surface it as the highlighted option
 * on the Login screen ("Last used"). Reduces auth friction for returning
 * users, especially across long gaps where they've forgotten which provider
 * they linked the account with.
 */

export type LastAuthMethod = "password" | "google" | "apple" | "magic-link";

const STORAGE_KEY = "nq.auth.lastMethod";

let cached: LastAuthMethod | null = null;
let hydrated = false;

export async function hydrateLastAuthMethod(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw && isValidMethod(raw)) cached = raw;
  } catch {
    /* ignore — fresh state is fine */
  }
}

export function peekLastAuthMethod(): LastAuthMethod | null {
  return cached;
}

export async function setLastAuthMethod(method: LastAuthMethod): Promise<void> {
  cached = method;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, method);
  } catch {
    /* best effort */
  }
}

export async function clearLastAuthMethod(): Promise<void> {
  cached = null;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function isValidMethod(value: string): value is LastAuthMethod {
  return (
    value === "password" ||
    value === "google" ||
    value === "apple" ||
    value === "magic-link"
  );
}
