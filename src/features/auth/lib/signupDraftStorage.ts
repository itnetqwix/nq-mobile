import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "nq:signup-draft:v1";

export type SignupDraft = {
  step?: string;
  fullname?: string;
  email?: string;
  mobile?: string;
  accountType?: string;
  category?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  updatedAt?: string;
};

export async function loadSignupDraft(): Promise<SignupDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SignupDraft;
  } catch {
    return null;
  }
}

export async function saveSignupDraft(draft: SignupDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() })
    );
  } catch {
    /* non-fatal */
  }
}

export async function clearSignupDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* non-fatal */
  }
}
