/**
 * Keeps mobile session UI aligned with web + Mongo when the app reconnects.
 * Runs on socket connect and when returning to foreground — does not auto-join
 * meetings (user taps Join / Rejoin or push deep link).
 */

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "../auth/context/AuthContext";
import { useInstantLesson } from "../instant-lesson/InstantLessonContext";
import { fetchScheduledMeetings } from "../home/api/homeApi";
import { useSocket } from "../socket/SocketContext";
import { queryKeys } from "../../lib/queryKeys";
import {
  accountTypeToReconcileRole,
  reconcileInstantLessonRows,
} from "../../lib/sessions/reconcileCrossPlatformSessions";

const RECONCILE_DEBOUNCE_MS = 800;

export function SessionLifecycleBridge() {
  const { status, accountType, user } = useAuth();
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  const {
    trainerIncoming,
    traineeBooking,
    focusTrainerRequestFromSession,
    restoreTraineeFlowFromSession,
  } = useInstantLesson();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (status !== "signedIn" || !isConnected) return;

    const userId = String((user as { _id?: string; id?: string })?._id ?? (user as { id?: string })?.id ?? "");
    const role = accountTypeToReconcileRole(accountType);
    if (!userId || !role) return;

    const run = () => {
      const now = Date.now();
      if (now - lastRunRef.current < RECONCILE_DEBOUNCE_MS) return;
      lastRunRef.current = now;

      void (async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });

        let rows: Record<string, unknown>[] = [];
        try {
          const [upcoming, confirmed] = await Promise.all([
            fetchScheduledMeetings("upcoming"),
            fetchScheduledMeetings("confirmed"),
          ]);
          const seen = new Set<string>();
          for (const r of [...upcoming, ...confirmed]) {
            const id = String(r._id ?? r.id ?? "");
            if (!id || seen.has(id)) continue;
            seen.add(id);
            rows.push(r as Record<string, unknown>);
          }
        } catch {
          return;
        }

        const picked = reconcileInstantLessonRows(rows, role, userId);

        if (role === "trainer") {
          if (!trainerIncoming && picked.trainerIncomingSession) {
            focusTrainerRequestFromSession(picked.trainerIncomingSession);
          } else if (!trainerIncoming && picked.trainerAcceptedSession) {
            focusTrainerRequestFromSession(picked.trainerAcceptedSession);
          }
        } else {
          if (!traineeBooking && picked.traineeWaitingSession) {
            restoreTraineeFlowFromSession(picked.traineeWaitingSession, "waiting");
          } else if (!traineeBooking && picked.traineeAcceptedSession) {
            restoreTraineeFlowFromSession(picked.traineeAcceptedSession, "accepted");
          }
        }
      })();
    };

    const schedule = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(run, RECONCILE_DEBOUNCE_MS);
    };

    schedule();

    const onAppState = (next: AppStateStatus) => {
      if (next === "active") schedule();
    };
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      sub.remove();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    status,
    isConnected,
    accountType,
    user,
    queryClient,
    trainerIncoming,
    traineeBooking,
    focusTrainerRequestFromSession,
    restoreTraineeFlowFromSession,
  ]);

  return null;
}
