import {
  enqueueOfflineAction,
  registerOfflineActionExecutor,
  type OfflineAction,
  type OfflineActionResult,
} from "../../lib/offline/offlineActionQueue";
import { uploadLockerClip } from "../home/api/homeApi";
import { deleteCapturedClip } from "./capturedClipsStorage";
import { lockerMutated } from "../../store/actions/cacheInvalidation";
import { store } from "../../store";

export const CAPTURE_CLIP_UPLOAD_KIND = "capture.clipUpload";

export type CaptureClipUploadPayload = {
  videoUri: string;
  videoMime: string;
  videoSizeBytes: number;
  thumbUri: string;
  title: string;
  category?: string;
  category_id: string;
  subcategory_id: string;
  shareOptions:
    | { type: "My Clips" }
    | { type: "Friends"; friends: string[] }
    | { type: "New Users"; emails: string[] };
  captureClipId?: string;
  userId?: string | null;
};

function isCaptureUploadPayload(
  payload: Record<string, unknown>
): payload is CaptureClipUploadPayload {
  return (
    typeof payload.videoUri === "string" &&
    typeof payload.thumbUri === "string" &&
    typeof payload.title === "string" &&
    typeof payload.category_id === "string" &&
    typeof payload.subcategory_id === "string" &&
    typeof payload.videoMime === "string" &&
    typeof payload.videoSizeBytes === "number" &&
    payload.shareOptions != null &&
    typeof payload.shareOptions === "object"
  );
}

async function executeCaptureClipUpload(
  action: OfflineAction
): Promise<OfflineActionResult> {
  if (!isCaptureUploadPayload(action.payload)) return "drop";
  const p = action.payload;
  await uploadLockerClip({
    videoUri: p.videoUri,
    videoMime: p.videoMime,
    videoSizeBytes: p.videoSizeBytes,
    thumbUri: p.thumbUri,
    title: p.title,
    category: p.category,
    category_id: p.category_id,
    subcategory_id: p.subcategory_id,
    shareOptions: p.shareOptions,
  });
  if (p.captureClipId) {
    await deleteCapturedClip(p.userId ?? null, p.captureClipId).catch(() => {});
  }
  store.dispatch(lockerMutated());
  return "done";
}

registerOfflineActionExecutor(CAPTURE_CLIP_UPLOAD_KIND, executeCaptureClipUpload);

export async function enqueueCaptureClipUpload(
  payload: CaptureClipUploadPayload
): Promise<void> {
  const id = `capture-upload:${payload.captureClipId ?? payload.videoUri}`;
  await enqueueOfflineAction(CAPTURE_CLIP_UPLOAD_KIND, payload, id);
}

export function isNetworkRequestError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  if ("response" in err && (err as { response?: unknown }).response) return false;
  const code = (err as { code?: string }).code;
  const message = (err as { message?: string }).message;
  return (
    code === "ERR_NETWORK" ||
    code === "ECONNABORTED" ||
    message === "Network Error"
  );
}
