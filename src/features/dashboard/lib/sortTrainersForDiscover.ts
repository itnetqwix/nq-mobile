import { getTrainerAvgRating } from "../../bookexpert/lib/trainerUtils";

/** Highest-rated first; live coaches bubble up within same rating band. */
export function sortTrainersForDiscover(
  rows: Array<Record<string, unknown> & { is_online?: boolean }>
): Array<Record<string, unknown> & { is_online?: boolean }> {
  return [...rows].sort((a, b) => {
    const liveA = a.is_online ? 1 : 0;
    const liveB = b.is_online ? 1 : 0;
    if (liveB !== liveA) return liveB - liveA;
    const rA = getTrainerAvgRating(a) ?? 0;
    const rB = getTrainerAvgRating(b) ?? 0;
    if (rB !== rA) return rB - rA;
    const nameA = String(a.fullname ?? a.fullName ?? "");
    const nameB = String(b.fullname ?? b.fullName ?? "");
    return nameA.localeCompare(nameB);
  });
}
