import AsyncStorage from "@react-native-async-storage/async-storage";
import * as VideoThumbnails from "expo-video-thumbnails";

export type CapturedClip = {
  id: string;
  uri: string;
  createdAt: string;
  label?: string;
  durationSecs?: number;
  fileSizeBytes?: number;
  mimeType?: string;
  thumbUri?: string;
};

const LEGACY_KEY = "@netqwix/captured_clips";
const PREFIX = "nq.capturedClips.";

function storageKey(userId: string | null | undefined): string {
  if (!userId) return `${PREFIX}guest`;
  return `${PREFIX}user.${userId}`;
}

async function persistClips(
  userId: string | null | undefined,
  clips: CapturedClip[]
): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(clips));
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
  await persistClips(userId, existing);
}

export async function updateCapturedClip(
  userId: string | null | undefined,
  id: string,
  patch: Partial<Omit<CapturedClip, "id">>
): Promise<void> {
  const existing = await getCapturedClips(userId);
  const idx = existing.findIndex((c) => c.id === id);
  if (idx < 0) return;
  existing[idx] = { ...existing[idx]!, ...patch };
  await persistClips(userId, existing);
}

export async function deleteCapturedClip(
  userId: string | null | undefined,
  id: string
): Promise<void> {
  const existing = await getCapturedClips(userId);
  const updated = existing.filter((c) => c.id !== id);
  await persistClips(userId, updated);
}

async function generateThumbUri(clip: CapturedClip): Promise<string | null> {
  try {
    const durationSec = clip.durationSecs ?? 2;
    const timeMs = Math.min(60_000, Math.max(250, Math.floor((durationSec / 2) * 1000)));
    const { uri } = await VideoThumbnails.getThumbnailAsync(clip.uri, {
      time: timeMs,
      quality: 0.85,
    });
    return uri;
  } catch {
    return null;
  }
}

/** Backfill missing thumbnails for legacy clips (runs once per missing row). */
export async function backfillCapturedClipThumbnails(
  userId: string | null | undefined
): Promise<CapturedClip[]> {
  const clips = await getCapturedClips(userId);
  let changed = false;
  const next = [...clips];

  for (let i = 0; i < next.length; i++) {
    const clip = next[i]!;
    if (clip.thumbUri) continue;
    const thumbUri = await generateThumbUri(clip);
    if (!thumbUri) continue;
    next[i] = { ...clip, thumbUri };
    changed = true;
  }

  if (changed) await persistClips(userId, next);
  return next;
}
