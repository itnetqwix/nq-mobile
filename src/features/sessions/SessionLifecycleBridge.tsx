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
import { invalidateForSocketEvent, invalidateSessions } from "../../lib/queryInvalidation";
import { LESSON_SOCKET_EVENTS } from "../../lib/sessions/sessionContract";
import { queryKeys } from "../../lib/queryKeys";
import {
  accountTypeToReconcileRole,
  reconcileInstantLessonRows,
} from "../../lib/sessions/reconcileCrossPlatformSessions";

const RECONCILE_DEBOUNCE_MS = 800;
const SESSIONS_FETCH_COOLDOWN_MS = 30_000;

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
  const lastSessionsFetchRef = useRef(0);
  const trainerIncomingRef = useRef(trainerIncoming);
  const traineeBookingRef = useRef(traineeBooking);
  const focusTrainerRef = useRef(focusTrainerRequestFromSession);
  const restoreTraineeRef = useRef(restoreTraineeFlowFromSession);

  trainerIncomingRef.current = trainerIncoming;
  traineeBookingRef.current = traineeBooking;
  focusTrainerRef.current = focusTrainerRequestFromSession;
  restoreTraineeRef.current = restoreTraineeFlowFromSession;

  useEffect(() => {
    if (status !== "signedIn" || !socket) return;

    const onLessonEnded = (payload?: { sessionId?: string }) => {
      invalidateForSocketEvent(queryClient, LESSON_SOCKET_EVENTS.TIME_ENDED);
      if (payload?.sessionId) {
        invalidateSessions(queryClient);
      }
    };

    socket.on(LESSON_SOCKET_EVENTS.TIME_ENDED, onLessonEnded);
    return () => {
      socket.off(LESSON_SOCKET_EVENTS.TIME_ENDED, onLessonEnded);
    };
  }, [status, socket, queryClient]);

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
        const skipFetch = now - lastSessionsFetchRef.current < SESSIONS_FETCH_COOLDOWN_MS;

        let rows: Record<string, unknown>[] = [];
        if (skipFetch) {
          const cachedUpcoming = queryClient.getQueryData<any[]>(queryKeys.sessions.upcoming);
          const cachedConfirmed = queryClient.getQueryData<any[]>(
            queryKeys.sessions.list("confirmed")
          );
          if (Array.isArray(cachedUpcoming) || Array.isArray(cachedConfirmed)) {
            const seen = new Set<string>();
            for (const r of [...(cachedUpcoming ?? []), ...(cachedConfirmed ?? [])]) {
              const id = String(r._id ?? r.id ?? "");
              if (!id || seen.has(id)) continue;
              seen.add(id);
              rows.push(r as Record<string, unknown>);
            }
          }
        }

        if (rows.length === 0) {
          try {
            const [upcoming, confirmed] = await Promise.all([
              queryClient.fetchQuery({
                queryKey: queryKeys.sessions.upcoming,
                queryFn: () => fetchScheduledMeetings("upcoming"),
                staleTime: SESSIONS_FETCH_COOLDOWN_MS,
              }),
              queryClient.fetchQuery({
                queryKey: queryKeys.sessions.list("confirmed"),
                queryFn: () => fetchScheduledMeetings("confirmed"),
                staleTime: SESSIONS_FETCH_COOLDOWN_MS,
              }),
            ]);
            lastSessionsFetchRef.current = Date.now();
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
        }

        const picked = reconcileInstantLessonRows(rows, role, userId);

        if (role === "trainer") {
          if (!trainerIncomingRef.current && picked.trainerIncomingSession) {
            focusTrainerRef.current(picked.trainerIncomingSession);
          } else if (!trainerIncomingRef.current && picked.trainerAcceptedSession) {
            focusTrainerRef.current(picked.trainerAcceptedSession);
          }
        } else {
          if (!traineeBookingRef.current && picked.traineeWaitingSession) {
            restoreTraineeRef.current(picked.traineeWaitingSession, "waiting");
          } else if (!traineeBookingRef.current && picked.traineeAcceptedSession) {
            restoreTraineeRef.current(picked.traineeAcceptedSession, "accepted");
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
  }, [status, isConnected, accountType, user, queryClient]);

  return null;
}
