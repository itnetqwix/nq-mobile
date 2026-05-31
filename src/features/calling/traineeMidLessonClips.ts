import {
  addTraineeClipsToBookedSession,
  type ClipRow,
} from "../instant-lesson/instantLessonClipsApi";
import { clipsFromSession } from "./clipSyncUtils";

/** Merge newly picked clips with clips already on the booking. */
export function mergeTraineeClipIds(
  session: Record<string, unknown> | null | undefined,
  picked: ClipRow[]
): string[] {
  const existing = clipsFromSession(session).map((c) => String(c._id));
  const pickedIds = picked.map((c) => String(c._id)).filter(Boolean);
  return [...new Set([...existing, ...pickedIds])];
}

/** Persist trainee clip ids on the booking (web parity). */
export async function persistTraineeClipsOnBooking(
  lessonId: string,
  session: Record<string, unknown> | null | undefined,
  picked: ClipRow[]
): Promise<string[]> {
  const mergedIds = mergeTraineeClipIds(session, picked);
  await addTraineeClipsToBookedSession(lessonId, mergedIds);
  return mergedIds;
}
