/**
 * Persist failed screenshot uploads and retry when the trainer captures again or calls flush.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import { putFileToPresignedUrl } from "../../lib/presignedPut";
import {
  mmkvHotStorage,
  readJsonFromMmkv,
  writeJsonToMmkv,
} from "../../lib/storage/mmkvHotStorage";
import {
  extractPresignedFilename,
  extractPresignedPutUrl,
} from "../../lib/http/extractPresignedUrl";
import { requestScreenshotUpload } from "./meetingReportApi";

const STORAGE_KEY = "nq_pending_screenshot_uploads_v1";
const UPLOAD_MIME = "image/jpeg";

export type PendingScreenshotUpload = {
  id: string;
  localUri: string;
  sessionId: string;
  trainerId: string;
  traineeId: string;
  createdAt: number;
  attempts: number;
};

async function migrateLegacyQueue(): Promise<void> {
  if (mmkvHotStorage.getString(STORAGE_KEY)) return;
  try {
    const legacy = await AsyncStorage.getItem(STORAGE_KEY);
    if (legacy) {
      mmkvHotStorage.set(STORAGE_KEY, legacy);
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

async function readQueue(): Promise<PendingScreenshotUpload[]> {
  try {
    await migrateLegacyQueue();
    const parsed = await readJsonFromMmkv<PendingScreenshotUpload[]>(STORAGE_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: PendingScreenshotUpload[]) {
  await writeJsonToMmkv(STORAGE_KEY, items);
}

export async function enqueueScreenshotUpload(
  entry: Omit<PendingScreenshotUpload, "id" | "createdAt" | "attempts">
): Promise<void> {
  const queue = await readQueue();
  const withoutDup = queue.filter(
    (q) =>
      !(
        q.sessionId === entry.sessionId &&
        q.localUri.split("?")[0] === entry.localUri.split("?")[0]
      )
  );
  withoutDup.push({
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    attempts: 0,
  });
  await writeQueue(withoutDup.slice(-20));
}

/** After cropping a queued frame, point the pending upload at the new file. */
export async function replaceQueuedUploadUri(
  oldUri: string,
  newUri: string
): Promise<void> {
  const oldNorm = oldUri.split("?")[0];
  const queue = await readQueue();
  let changed = false;
  const next = queue.map((item) => {
    if (item.localUri.split("?")[0] === oldNorm) {
      changed = true;
      return { ...item, localUri: newUri, attempts: 0 };
    }
    return item;
  });
  if (changed) await writeQueue(next);
}

export async function flushScreenshotUploadQueue(options?: {
  sessionId?: string;
  onUploaded?: (imageKey: string) => void;
}): Promise<number> {
  const queue = await readQueue();
  if (!queue.length) return 0;

  let uploaded = 0;
  const remaining: PendingScreenshotUpload[] = [];

  for (const item of queue) {
    if (options?.sessionId && item.sessionId !== options.sessionId) {
      remaining.push(item);
      continue;
    }
    try {
      const normalized = item.localUri.split("?")[0];
      const info = await FileSystem.getInfoAsync(normalized);
      if (!info.exists) continue;

      const presignBody = await requestScreenshotUpload({
        sessions: item.sessionId,
        trainer: item.trainerId,
        trainee: item.traineeId,
      });
      const uploadUrl = extractPresignedPutUrl(presignBody);
      if (!uploadUrl) {
        remaining.push({ ...item, attempts: item.attempts + 1 });
        continue;
      }
      await putFileToPresignedUrl(uploadUrl, item.localUri, UPLOAD_MIME);
      const imageKey = extractPresignedFilename(presignBody) ?? `file-${Date.now()}.jpg`;
      uploaded += 1;
      options?.onUploaded?.(imageKey);
      await FileSystem.deleteAsync(normalized, { idempotent: true }).catch(() => {});
    } catch {
      if (item.attempts < 8) {
        remaining.push({ ...item, attempts: item.attempts + 1 });
      }
    }
  }

  await writeQueue(remaining);
  return uploaded;
}
