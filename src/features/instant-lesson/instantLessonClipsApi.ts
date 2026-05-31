import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { postMyClipsNested } from "../clips/api/clipsApi";
import {
  flattenNestedClipsForPicker,
  type PickerClipRow,
} from "../../lib/lists/clipListUtils";

export type ClipRow = PickerClipRow;

/** POST `/common/get-clips` — same locker data as the Clips tab (nested taxonomy). */
export async function fetchMyClipsForBooking(): Promise<ClipRow[]> {
  const nested = await postMyClipsNested();
  return flattenNestedClipsForPicker(nested);
}

/** @deprecated Use `fetchMyClipsForBooking` — kept for callers expecting grouped shape. */
export type ClipGroup = { _id: string; clips: ClipRow[] };

export async function fetchMyClipsGrouped(): Promise<ClipGroup[]> {
  const flat = await fetchMyClipsForBooking();
  if (flat.length === 0) return [];
  return [{ _id: "locker", clips: flat }];
}

export function flattenGroupedClips(groups: ClipGroup[]): ClipRow[] {
  const out: ClipRow[] = [];
  for (const g of groups || []) {
    for (const c of g.clips || []) {
      if (c?._id) out.push(c);
    }
  }
  return out;
}

/** PUT `/user/add-trainee-clip/:id` — same payload as web `addTraineeClipInBookedSession`. */
export async function addTraineeClipsToBookedSession(lessonId: string, clipIds: string[]): Promise<void> {
  await apiClient.put(API_ROUTES.user.addTraineeClip(lessonId), {
    id: lessonId,
    trainee_clip: clipIds,
  });
}
