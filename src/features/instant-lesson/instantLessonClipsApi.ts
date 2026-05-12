import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";

export type ClipRow = {
  _id: string;
  title?: string;
  name?: string;
  category?: string;
  thumbnail?: string;
};

export type ClipGroup = { _id: string; clips: ClipRow[] };

/** POST `/common/get-clips` — same as web `myClips` / locker clip picker. */
export async function fetchMyClipsGrouped(): Promise<ClipGroup[]> {
  const res = await apiClient.post(API_ROUTES.common.getClips, {});
  const raw = res.data?.data ?? res.data?.result ?? res.data;
  return Array.isArray(raw) ? raw : [];
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
