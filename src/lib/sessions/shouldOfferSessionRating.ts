import { hasViewerRated } from "./sessionRatingUtils";
import {
  getSessionEnd,
  isSessionInProgress,
  normalizeSessionStatus,
} from "./sessionUtils";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** True when the other party has entered the lesson (trainer may be in-call early). */
export function isLessonLiveOnServer(session: Record<string, unknown> | null | undefined): boolean {
  if (!session) return false;
  if (session.first_joined_at || session.both_joined_at) return true;
  return String(session.instant_phase ?? "").toUpperCase() === "ACTIVE";
}

/**
 * Whether to show post-session rating UI (home banner / pending stash).
 * Suppresses during active lessons and before the scheduled end time.
 */
export function shouldOfferSessionRating(
  session: Record<string, unknown> | null | undefined,
  isTrainer: boolean,
  opts?: {
    /** Upcoming / in-progress sessions from the dashboard list. */
    activeSessions?: Array<Record<string, unknown>>;
    now?: Date;
  }
): boolean {
  if (!session) return false;

  const id = String(session._id ?? session.id ?? "");
  if (!id) return false;

  const status = normalizeSessionStatus(session.status as string);
  const ratingEligibleStatus =
    status === "completed" || status === "confirm" || status === "confirmed";
  if (!ratingEligibleStatus) return false;
  if (hasViewerRated(session, isTrainer)) return false;

  const now = opts?.now ?? new Date();
  const active = opts?.activeSessions ?? [];

  if (active.some((s) => String(s._id ?? s.id) === id)) return false;
  if (active.some((s) => isSessionInProgress(s, now))) return false;

  const end = getSessionEnd(session);
  const endMs =
    end?.getTime() ??
    new Date(
      String(session.updatedAt ?? session.end_time ?? session.booked_date ?? "")
    ).getTime();
  if (!Number.isFinite(endMs)) return false;
  if (now.getTime() < endMs) return false;

  if (now.getTime() - endMs > SEVEN_DAYS_MS) return false;

  return true;
}
