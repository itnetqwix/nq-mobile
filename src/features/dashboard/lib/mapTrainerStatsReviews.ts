import type { MyTrainerStats } from "../../home/api/homeApi";
import type { TrainerReview } from "../../bookexpert/lib/trainerUtils";

/** Normalise `GET /trainer/my-stats` review rows for list UIs. */
export function mapTrainerStatsReviews(
  reviews: MyTrainerStats["reviews"] | undefined
): TrainerReview[] {
  if (!reviews?.length) return [];

  const out: TrainerReview[] = [];
  for (let i = 0; i < reviews.length; i++) {
    const row = reviews[i];
    const trainee = row.ratings?.trainee;
    const score = Number(trainee?.sessionRating);
    if (!Number.isFinite(score) || score <= 0) continue;

    const remarks =
      (trainee as { remarksInfo?: string; comment?: string } | undefined)?.remarksInfo ??
      (trainee as { comment?: string } | undefined)?.comment;

    out.push({
      id: String(row._id ?? `review-${i}`),
      traineeName: row.trainee_fullname?.trim() || "Trainee",
      sessionRating: score,
      title: (trainee as { title?: string } | undefined)?.title || undefined,
      remarks: remarks ? String(remarks) : undefined,
      updatedAt: row.updatedAt,
    });
  }

  return out.sort((a, b) => {
    const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return tb - ta;
  });
}
