import * as FileSystem from "expo-file-system/legacy";
import type { ClipConfirmPayload } from "../home/api/homeApi";
import { uploadLockerClip } from "../home/api/homeApi";
import type { CapturedClip } from "./capturedClipsStorage";
import { deleteCapturedClip } from "./capturedClipsStorage";

export async function resolveVideoSizeBytes(uri: string, known?: number): Promise<number> {
  if (known != null && known > 0) return known;
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (info.exists && "size" in info && typeof info.size === "number" && info.size > 0) {
      return info.size;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

/** Normalize iOS/Android capture MIME for `/storage/clips/presign`. */
export function normalizeCaptureVideoMime(mime?: string | null): string {
  const raw = String(mime ?? "").trim().toLowerCase();
  if (raw === "video/quicktime" || raw === "video/mov") return "video/quicktime";
  if (raw.startsWith("video/")) return raw;
  return "video/mp4";
}

export type BatchClipItem = {
  clip: CapturedClip;
  videoUri: string;
  thumbUri: string;
  title: string;
  captureClipId?: string;
};

export type BatchUploadProgress = {
  index: number;
  total: number;
  clipTitle: string;
  videoPercent: number;
  phase: "video" | "thumb" | "finalize";
};

export async function uploadCapturedClipsBatch(params: {
  items: BatchClipItem[];
  videoMime: string;
  category?: string;
  category_id: string;
  subcategory_id: string;
  shareOptions: ClipConfirmPayload["shareOptions"];
  userId: string | null;
  onProgress?: (p: BatchUploadProgress) => void;
}): Promise<{ uploaded: number; clipIds: string[] }> {
  const clipIds: string[] = [];
  const total = params.items.length;

  for (let index = 0; index < total; index++) {
    const item = params.items[index]!;
    const fileBytes = await resolveVideoSizeBytes(item.videoUri, item.clip.fileSizeBytes);
    if (fileBytes <= 0) {
      throw new Error("Could not read video file size. Try re-capturing or pick the clip again.");
    }

    const { clipId } = await uploadLockerClip({
      videoUri: item.videoUri,
      videoMime: normalizeCaptureVideoMime(params.videoMime ?? item.clip.mimeType),
      videoSizeBytes: fileBytes,
      thumbUri: item.thumbUri,
      title: item.title.trim(),
      category: params.category,
      category_id: params.category_id,
      subcategory_id: params.subcategory_id,
      shareOptions: params.shareOptions,
      onVideoProgress: (percent) => {
        params.onProgress?.({
          index: index + 1,
          total,
          clipTitle: item.title,
          videoPercent: percent,
          phase: "video",
        });
      },
      onThumbProgress: (percent) => {
        params.onProgress?.({
          index: index + 1,
          total,
          clipTitle: item.title,
          videoPercent: percent,
          phase: "thumb",
        });
      },
    });

    if (clipId) clipIds.push(clipId);
    if (item.captureClipId) {
      await deleteCapturedClip(params.userId, item.captureClipId).catch(() => {});
    }
    params.onProgress?.({
      index: index + 1,
      total,
      clipTitle: item.title,
      videoPercent: 100,
      phase: "finalize",
    });
  }

  return { uploaded: total, clipIds };
}

export function parseShareEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}
