import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "nq.introOnboarding.v1";

/**
 * In-memory mirror of the persisted flag. Warmed during app bootstrap so the
 * root navigator can decide intro-vs-auth synchronously and never flash a loader.
 */
let cachedIntroComplete: boolean | null = null;

/** Synchronous read of the warmed cache; `null` until first hydration. */
export function getIntroOnboardingCompleteSync(): boolean | null {
  return cachedIntroComplete;
}

export async function isIntroOnboardingComplete(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cachedIntroComplete = raw === "1";
    return cachedIntroComplete;
  } catch {
    cachedIntroComplete = false;
    return false;
  }
}

export async function setIntroOnboardingComplete(): Promise<void> {
  cachedIntroComplete = true;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* non-fatal */
  }
}

/** Dev / settings "replay intro" — next cold start shows carousel again. */
export async function clearIntroOnboardingComplete(): Promise<void> {
  cachedIntroComplete = false;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
}
