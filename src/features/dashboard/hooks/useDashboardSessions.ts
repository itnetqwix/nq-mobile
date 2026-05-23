import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AccountType } from "../../../constants/accountType";
import { queryKeys } from "../../../lib/queryKeys";
import {
  isSessionInProgress,
  shouldShowInDashboardRequests,
  shouldShowInDashboardUpcoming,
} from "../../../lib/sessions/sessionUtils";
import { fetchScheduledMeetings } from "../../home/api/homeApi";

function sessionStartMs(session: Record<string, unknown>): number {
  const raw =
    session.booked_date ||
    session.start_time ||
    session.session_start_time;
  const ms = new Date(String(raw)).getTime();
  return Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER;
}

export function useDashboardSessions(accountType: string | null) {
  const isTrainer = accountType === AccountType.TRAINER;

  const { data: sessions = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.sessions.upcoming,
    queryFn: () => fetchScheduledMeetings("upcoming"),
    staleTime: 60_000,
    enabled: Boolean(accountType),
  });

  const nowSessions = useMemo(
    () => sessions.filter((s: Record<string, unknown>) => isSessionInProgress(s)),
    [sessions]
  );

  const pendingSessions = useMemo(
    () =>
      isTrainer
        ? sessions.filter((s: Record<string, unknown>) => shouldShowInDashboardRequests(s))
        : [],
    [sessions, isTrainer]
  );

  const upcomingConfirmed = useMemo(
    () => sessions.filter((s: Record<string, unknown>) => shouldShowInDashboardUpcoming(s)),
    [sessions]
  );

  const nextSession = useMemo(() => {
    const pool = [...nowSessions, ...upcomingConfirmed];
    if (!pool.length) return null;
    return [...pool].sort((a, b) => sessionStartMs(a) - sessionStartMs(b))[0] ?? null;
  }, [nowSessions, upcomingConfirmed]);

  const todayTimeline = useMemo(() => {
    const pool = [...nowSessions, ...upcomingConfirmed];
    return [...pool].sort((a, b) => sessionStartMs(a) - sessionStartMs(b)).slice(0, 3);
  }, [nowSessions, upcomingConfirmed]);

  return {
    sessions,
    isLoading,
    refetch,
    isRefetching,
    nowSessions,
    pendingSessions,
    upcomingConfirmed,
    nextSession,
    todayTimeline,
    isTrainer,
  };
}
