import type { ClipConfirmPayload } from "../home/api/homeApi";
import { uploadLockerClip } from "../home/api/homeApi";
import type { CapturedClip } from "./capturedClipsStorage";
import { deleteCapturedClip } from "./capturedClipsStorage";

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
    let fileBytes = item.clip.fileSizeBytes ?? 0;

    const { clipId } = await uploadLockerClip({
      videoUri: item.videoUri,
      videoMime: params.videoMime,
      videoSizeBytes: fileBytes > 0 ? fileBytes : 1,
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
