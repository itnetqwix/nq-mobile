import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "nq.introOnboarding.v1";

export async function isIntroOnboardingComplete(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

export async function setIntroOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* non-fatal */
  }
}

/** Dev / settings "replay intro" — next cold start shows carousel again. */
export async function clearIntroOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
}
