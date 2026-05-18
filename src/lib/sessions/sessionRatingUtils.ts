/** Whether the current viewer has submitted ratings for this booking. */
export function hasViewerRated(session: any, isTrainer: boolean): boolean {
  const ratings = session?.ratings;
  if (!ratings || typeof ratings !== "object") return false;

  if (isTrainer) {
    const t = ratings.trainer;
    return !!(t && (t.sessionRating || t.audioVideoRating));
  }

  const tr = ratings.trainee;
  return !!(tr && (tr.sessionRating || tr.audioVideoRating));
}

export function getViewerRatingSummary(session: any, isTrainer: boolean): string | null {
  const ratings = session?.ratings;
  if (!ratings) return null;
  const block = isTrainer ? ratings.trainer : ratings.trainee;
  if (!block?.sessionRating) return null;
  const av = block.audioVideoRating ? ` · A/V ${block.audioVideoRating}/5` : "";
  return `Session ${block.sessionRating}/5${av}`;
}
