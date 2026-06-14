import AsyncStorage from "@react-native-async-storage/async-storage";

export type CapturedClip = {
  id: string;
  uri: string;
  createdAt: string;
  label?: string;
  durationSecs?: number;
  fileSizeBytes?: number;
  mimeType?: string;
};

const LEGACY_KEY = "@netqwix/captured_clips";
const PREFIX = "nq.capturedClips.";

function storageKey(userId: string | null | undefined): string {
  if (!userId) return `${PREFIX}guest`;
  return `${PREFIX}user.${userId}`;
}

export async function getCapturedClips(
  userId: string | null | undefined
): Promise<CapturedClip[]> {
  const key = storageKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) return JSON.parse(raw) as CapturedClip[];
    if (!userId) return [];
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (!legacy) return [];
    const parsed = JSON.parse(legacy) as CapturedClip[];
    await AsyncStorage.setItem(key, legacy);
    await AsyncStorage.removeItem(LEGACY_KEY);
    return parsed;
  } catch {
    return [];
  }
}

export async function saveCapturedClip(
  userId: string | null | undefined,
  clip: CapturedClip
): Promise<void> {
  const existing = await getCapturedClips(userId);
  existing.unshift(clip);
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(existing));
}

export async function deleteCapturedClip(
  userId: string | null | undefined,
  id: string
): Promise<void> {
  const existing = await getCapturedClips(userId);
  const updated = existing.filter((c) => c.id !== id);
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(updated));
}
