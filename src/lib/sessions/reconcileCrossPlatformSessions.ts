/**
 * Server-driven reconciliation for instant-lesson UI when the user opens mobile
 * after acting on web (or vice versa). Does not start media — only restores
 * banners/modals that match Mongo + deadline fields.
 */

import { AccountType } from "../../constants/accountType";
import {
  getInstantJoinDeadlineMs,
  isInstantLesson,
  isPendingBooking,
  isSessionInProgress,
  isSessionTerminalForUI,
  normalizeSessionStatus,
  shouldShowInDashboardRequests,
} from "./sessionUtils";
import { INSTANT_JOIN_AFTER_ACCEPT_MS } from "./instantLessonConstants";

export type ReconcileRole = "trainer" | "trainee";

export type ReconcileInstantLessonResult = {
  /** Trainer: pending accept window still open */
  trainerIncomingSession?: Record<string, unknown>;
  /** Trainer: accepted, join window open */
  trainerAcceptedSession?: Record<string, unknown>;
  /** Trainee: waiting for coach accept */
  traineeWaitingSession?: Record<string, unknown>;
  /** Trainee: coach accepted, can join */
  traineeAcceptedSession?: Record<string, unknown>;
  /** Any session currently in live/rejoin window (scheduled or instant) */
  liveSession?: Record<string, unknown>;
};

function joinDeadlineMs(session: Record<string, unknown>, now: Date): number {
  const fromApi = getInstantJoinDeadlineMs(session);
  if (fromApi != null) return fromApi;
  const acceptedAt = session.accepted_at
    ? new Date(String(session.accepted_at)).getTime()
    : NaN;
  if (Number.isFinite(acceptedAt)) return acceptedAt + INSTANT_JOIN_AFTER_ACCEPT_MS;
  return 0;
}

function isJoinWindowOpen(session: Record<string, unknown>, now: Date): boolean {
  const ms = joinDeadlineMs(session, now);
  return ms > now.getTime();
}

/**
 * Pick the best instant-lesson rows to restore local UI from an upcoming/confirmed fetch.
 */
export function reconcileInstantLessonRows(
  rows: Record<string, unknown>[],
  role: ReconcileRole,
  userId: string,
  now = new Date()
): ReconcileInstantLessonResult {
  const result: ReconcileInstantLessonResult = {};

  for (const row of rows) {
    if (!row || isSessionTerminalForUI(row, now)) continue;

    if (isSessionInProgress(row, now)) {
      if (!result.liveSession) result.liveSession = row;
    }

    if (!isInstantLesson(row)) continue;

    const status = normalizeSessionStatus(row.status as string);
    const isTrainer = role === "trainer";
    const ownsTrainer = String(row.trainer_id ?? "") === userId;
    const ownsTrainee = String(row.trainee_id ?? "") === userId;

    if (isTrainer && ownsTrainer) {
      if (isPendingBooking(row) && shouldShowInDashboardRequests(row, now)) {
        result.trainerIncomingSession = row;
      } else if (
        (status === "confirmed" || status === "upcoming") &&
        isJoinWindowOpen(row, now)
      ) {
        result.trainerAcceptedSession = row;
      }
    }

    if (!isTrainer && ownsTrainee) {
      if (isPendingBooking(row) && shouldShowInDashboardRequests(row, now)) {
        result.traineeWaitingSession = row;
      } else if (
        (status === "confirmed" || status === "upcoming") &&
        isJoinWindowOpen(row, now)
      ) {
        result.traineeAcceptedSession = row;
      }
    }
  }

  return result;
}

export function accountTypeToReconcileRole(
  accountType: string | null | undefined
): ReconcileRole | null {
  if (accountType === AccountType.TRAINER) return "trainer";
  if (accountType === AccountType.TRAINEE) return "trainee";
  return null;
}
