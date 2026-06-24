import type { LockerClip } from "../../features/clips/api/clipsApi";

export type TraineeClipGroup = {
  traineeId: string;
  traineeName: string;
  traineeAvatar?: string;
  clips: LockerClip[];
};

/** Normalize `POST /common/trainee-clips` groups (bookings nested under each trainee user). */
export function parseTraineeClipGroups(data: unknown): TraineeClipGroup[] {
  if (!Array.isArray(data)) return [];

  const groups: TraineeClipGroup[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const trainee =
      row._id && typeof row._id === "object"
        ? (row._id as Record<string, unknown>)
        : (row.clip_user as Record<string, unknown> | undefined);
    const traineeId = String(trainee?._id ?? "");
    if (!traineeId) continue;

    const traineeName = String(
      trainee?.fullname ?? trainee?.fullName ?? trainee?.name ?? "Student"
    ).trim();
    const bookingRows = Array.isArray(row.clips) ? row.clips : [];
    const clips: LockerClip[] = [];

    for (const booking of bookingRows) {
      if (!booking || typeof booking !== "object") continue;
      const bookingRow = booking as Record<string, unknown>;
      const clip =
        bookingRow.clips &&
        typeof bookingRow.clips === "object" &&
        !Array.isArray(bookingRow.clips)
          ? (bookingRow.clips as LockerClip)
          : (bookingRow as LockerClip);
      if (clip?._id) clips.push(clip);
    }

    if (clips.length > 0) {
      groups.push({
        traineeId,
        traineeName,
        traineeAvatar: trainee?.profile_picture as string | undefined,
        clips,
      });
    }
  }

  return groups;
}

export function mergeRecentTraineeRows(
  recentTrainees: Record<string, unknown>[],
  clipGroups: TraineeClipGroup[]
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const trainee of recentTrainees) {
    const id = String(trainee._id ?? "");
    if (id) byId.set(id, trainee);
  }
  for (const group of clipGroups) {
    if (!byId.has(group.traineeId)) {
      byId.set(group.traineeId, {
        _id: group.traineeId,
        fullname: group.traineeName,
        profile_picture: group.traineeAvatar,
      });
    }
  }
  return [...byId.values()];
}
