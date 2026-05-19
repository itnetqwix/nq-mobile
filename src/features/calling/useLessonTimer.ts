/**
 * useLessonTimer (mobile port)
 * ─────────────────────────────────────────────────────────────────────────────
 * RN port of `nq-frontend-main/app/components/video/hooks/useLessonTimer.js`.
 * The backend `lesson_timer` socket protocol is identical for web + mobile —
 * the only difference is the local 1-second tick uses `setInterval` exactly
 * like the web (RN exposes the same global).
 *
 * Events listened (server → client):
 *   LESSON_STATE_SYNC, TIMER_STARTED, LESSON_TIME_PAUSED, LESSON_TIME_RESUMED,
 *   LESSON_TIME_ENDED, LESSON_TIMER_ERROR
 *
 * Events emitted (client → server):
 *   LESSON_STATE_REQUEST, LESSON_TIMER_START_REQUEST,
 *   LESSON_TIMER_PAUSE_REQUEST, LESSON_TIMER_RESUME_REQUEST
 *
 * Trainer auto-start: once both peers are joined + a small client-side buffer
 * has elapsed, the trainer client requests `LESSON_TIMER_START_REQUEST` once.
 * Identical to the web auto-start to keep behaviour consistent across clients.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import { AccountType } from "../../constants/accountType";

const TIMER_EVENTS = {
  STATE_SYNC: "LESSON_STATE_SYNC",
  STARTED: "TIMER_STARTED",
  PAUSED: "LESSON_TIME_PAUSED",
  RESUMED: "LESSON_TIME_RESUMED",
  ENDED: "LESSON_TIME_ENDED",
  EXTENDED: "LESSON_TIMER_EXTENDED",
  ERROR: "LESSON_TIMER_ERROR",
  STATE_REQUEST: "LESSON_STATE_REQUEST",
  START_REQUEST: "LESSON_TIMER_START_REQUEST",
  PAUSE_REQUEST: "LESSON_TIMER_PAUSE_REQUEST",
  RESUME_REQUEST: "LESSON_TIMER_RESUME_REQUEST",
} as const;

export type LessonTimerStatus = "waiting" | "running" | "paused" | "ended";

export type LessonTimerSnapshot = {
  sessionId: string;
  startedAt: string | null;
  duration: number;
  remainingSeconds: number;
};

/** Minimal shape of a booked-session row we read for the fallback countdown.
 *  Matches what the backend returns on `/sessions/*` lookups — every field is
 *  optional so we can degrade gracefully whatever the caller has in hand. */
export type LessonTimerSessionInput = {
  start_time?: string | Date | null;
  end_time?: string | Date | null;
  session_start_time?: string | null;
  session_end_time?: string | null;
  extended_session_end_time?: string | null;
  is_instant?: boolean;
  duration?: number | string | null;
} | null;

type Args = {
  socket: Socket | null;
  sessionId: string;
  bothUsersJoined: boolean;
  timerBufferElapsed: boolean;
  accountType: string | null;
  /** Optional booked-session row. When the backend TIMER_STARTED event hasn't
   *  arrived yet (slow socket, missing protocol on the deployed API, etc.) we
   *  derive a best-effort countdown from this for web parity. See
   *  `nq-frontend-main/app/components/portrait-calling/index.jsx` ~ line 2722. */
  session?: LessonTimerSessionInput;
};

const TIMER_BUFFER_SECONDS = 5;

function parseHHMMToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Derive a duration (seconds) for the fallback countdown. We try the most
 *  reliable signals first: explicit Date `start_time`/`end_time`, then HH:mm
 *  pairs in `session_start_time`/`session_end_time`, then an explicit
 *  `duration` field. Returns null when nothing usable is present. */
function deriveDurationSeconds(session: LessonTimerSessionInput): number | null {
  if (!session) return null;

  const durationMinutes =
    (session as { duration_minutes?: number }).duration_minutes ??
    (session as { durationMinutes?: number }).durationMinutes;

  if ((session as { is_instant?: boolean }).is_instant) {
    if (typeof durationMinutes === "number" && durationMinutes > 0) {
      return Math.floor(durationMinutes * 60);
    }
  }

  const start = toDate(session.start_time);
  const end = toDate(session.extended_session_end_time) ?? toDate(session.end_time);
  if (start && end && end.getTime() > start.getTime()) {
    return Math.floor((end.getTime() - start.getTime()) / 1000);
  }
  const startMins = parseHHMMToMinutes(session.session_start_time);
  const endMins = parseHHMMToMinutes(
    session.extended_session_end_time ?? session.session_end_time
  );
  if (startMins != null && endMins != null) {
    let minutes = endMins - startMins;
    if (minutes < 0) minutes += 24 * 60;
    return Math.max(0, Math.floor(minutes * 60));
  }
  if (typeof session.duration === "number" && session.duration > 0) {
    return Math.floor(session.duration * 60);
  }
  if (typeof session.duration === "string") {
    const n = Number(session.duration);
    if (!Number.isNaN(n) && n > 0) return Math.floor(n * 60);
  }
  return null;
}

export function useLessonTimer({
  socket,
  sessionId,
  bothUsersJoined,
  timerBufferElapsed,
  accountType,
  session,
}: Args) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const bothJoinedAtRef = useRef<number | null>(null);
  const autoStartedRef = useRef(false);
  const [authoritativeTimer, setAuthoritativeTimer] =
    useState<LessonTimerSnapshot | null>(null);
  const [status, setStatus] = useState<LessonTimerStatus>("waiting");
  const [participantsConnected, setParticipantsConnected] = useState(false);
  const [trainerConnectedFromState, setTrainerConnectedFromState] = useState<
    boolean | null
  >(null);
  const [traineeConnectedFromState, setTraineeConnectedFromState] = useState<
    boolean | null
  >(null);
  const [retryToken, setRetryToken] = useState(0);
  const [fallbackRemainingSeconds, setFallbackRemainingSeconds] = useState<
    number | null
  >(null);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startLessonTimer = useCallback(
    ({
      sessionId: sid,
      startedAt,
      duration,
      remainingSeconds,
    }: {
      sessionId: string;
      startedAt: string | null | undefined;
      duration: number;
      remainingSeconds?: number;
    }) => {
      if (!sid || !duration) return;
      stopInterval();

      const remainingAtStart =
        typeof remainingSeconds === "number" && remainingSeconds >= 0
          ? Math.floor(remainingSeconds)
          : Math.floor(duration);
      const baseRemaining = startedAt
        ? Math.max(
            0,
            Math.floor(
              remainingAtStart -
                (Date.now() - new Date(startedAt).getTime()) / 1000
            )
          )
        : remainingAtStart;

      const tickStart = Date.now();
      setAuthoritativeTimer({
        sessionId: sid,
        startedAt: startedAt ?? null,
        duration,
        remainingSeconds: baseRemaining,
      });

      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - tickStart) / 1000);
        const current = Math.max(0, baseRemaining - elapsed);
        setAuthoritativeTimer((prev) =>
          prev
            ? { ...prev, remainingSeconds: current }
            : {
                sessionId: sid,
                startedAt: startedAt ?? null,
                duration,
                remainingSeconds: current,
              }
        );
        if (current <= 0) stopInterval();
      }, 1000);
    },
    [stopInterval]
  );

  const requestStart = useCallback(() => {
    socket?.emit(TIMER_EVENTS.START_REQUEST, { sessionId });
  }, [socket, sessionId]);
  const requestPause = useCallback(() => {
    socket?.emit(TIMER_EVENTS.PAUSE_REQUEST, { sessionId });
  }, [socket, sessionId]);
  const requestResume = useCallback(() => {
    socket?.emit(TIMER_EVENTS.RESUME_REQUEST, { sessionId });
  }, [socket, sessionId]);

  useEffect(() => {
    if (!socket || !sessionId) return;
    const matches = (data: any) => data && String(data.sessionId) === String(sessionId);

    const handleStateSync = (state: any) => {
      if (!matches(state)) return;
      const { status: s, startedAt, duration, remainingSeconds, trainerConnected, traineeConnected } = state;
      setStatus(s || "waiting");
      if (typeof trainerConnected === "boolean") {
        setTrainerConnectedFromState(trainerConnected);
      }
      if (typeof traineeConnected === "boolean") {
        setTraineeConnectedFromState(traineeConnected);
      }
      setParticipantsConnected(!!trainerConnected && !!traineeConnected);

      if (s === "running" && startedAt && duration) {
        startLessonTimer({ sessionId, startedAt, duration, remainingSeconds });
      } else if (s === "paused") {
        stopInterval();
        setAuthoritativeTimer({
          sessionId,
          startedAt: null,
          duration: duration || remainingSeconds || 0,
          remainingSeconds: Math.max(0, Math.floor(remainingSeconds || 0)),
        });
      } else if (s === "ended") {
        stopInterval();
        setAuthoritativeTimer({
          sessionId,
          startedAt: null,
          duration: duration || 0,
          remainingSeconds: 0,
        });
      }
    };

    const handleStarted = (data: any) => {
      if (!matches(data)) return;
      setStatus("running");
      if (data.startedAt && data.duration) {
        startLessonTimer({
          sessionId,
          startedAt: data.startedAt,
          duration: data.duration,
          remainingSeconds: data.remainingSeconds,
        });
      } else {
        socket.emit(TIMER_EVENTS.STATE_REQUEST, { sessionId });
      }
    };

    const handlePaused = (data: any) => {
      if (!matches(data)) return;
      setStatus("paused");
      stopInterval();
      setAuthoritativeTimer((prev) => ({
        sessionId,
        startedAt: null,
        duration: prev?.duration || data.duration || 0,
        remainingSeconds: Math.max(0, Math.floor(data.remainingSeconds || 0)),
      }));
    };

    const handleResumed = (data: any) => {
      if (!matches(data)) return;
      setStatus("running");
      startLessonTimer({
        sessionId,
        startedAt: data.startedAt,
        duration: data.duration,
        remainingSeconds: data.remainingSeconds,
      });
    };

    const handleEnded = (data: any) => {
      if (!matches(data)) return;
      setStatus("ended");
      stopInterval();
      setAuthoritativeTimer((prev) => ({
        sessionId,
        startedAt: null,
        duration: prev?.duration || 0,
        remainingSeconds: 0,
      }));
    };

    const handleExtended = (data: any) => {
      if (!matches(data)) return;
      setStatus("running");
      if (data.startedAt != null && data.duration != null) {
        startLessonTimer({
          sessionId,
          startedAt: data.startedAt ?? new Date().toISOString(),
          duration: data.duration,
          remainingSeconds: data.remainingSeconds,
        });
      } else if (typeof data.remainingSeconds === "number") {
        startLessonTimer({
          sessionId,
          startedAt: new Date().toISOString(),
          duration: data.duration ?? data.remainingSeconds,
          remainingSeconds: data.remainingSeconds,
        });
      }
    };

    const handleTimerError = (_data: any) => {
      autoStartedRef.current = false;
      setTimeout(() => setRetryToken((t) => t + 1), 2000);
    };

    /** Mobile sockets churn on background/foreground — re-emit the state
     *  request every time we (re)connect so we don't sit on a stale timer. */
    const handleReconnect = () => {
      socket.emit(TIMER_EVENTS.STATE_REQUEST, { sessionId });
    };

    socket.emit(TIMER_EVENTS.STATE_REQUEST, { sessionId });
    socket.on(TIMER_EVENTS.STATE_SYNC, handleStateSync);
    socket.on(TIMER_EVENTS.STARTED, handleStarted);
    socket.on(TIMER_EVENTS.PAUSED, handlePaused);
    socket.on(TIMER_EVENTS.RESUMED, handleResumed);
    socket.on(TIMER_EVENTS.ENDED, handleEnded);
    socket.on(TIMER_EVENTS.EXTENDED, handleExtended);
    socket.on(TIMER_EVENTS.ERROR, handleTimerError);
    socket.on("connect", handleReconnect);
    socket.on("reconnect", handleReconnect);

    return () => {
      socket.off(TIMER_EVENTS.STATE_SYNC, handleStateSync);
      socket.off(TIMER_EVENTS.STARTED, handleStarted);
      socket.off(TIMER_EVENTS.PAUSED, handlePaused);
      socket.off(TIMER_EVENTS.RESUMED, handleResumed);
      socket.off(TIMER_EVENTS.ENDED, handleEnded);
      socket.off(TIMER_EVENTS.EXTENDED, handleExtended);
      socket.off(TIMER_EVENTS.ERROR, handleTimerError);
      socket.off("connect", handleReconnect);
      socket.off("reconnect", handleReconnect);
      stopInterval();
    };
  }, [socket, sessionId, startLessonTimer, stopInterval]);

  useEffect(() => {
    if (!socket || !sessionId) return;
    const id = setInterval(() => {
      if (socket.connected) socket.emit(TIMER_EVENTS.STATE_REQUEST, { sessionId });
    }, 10_000);
    return () => clearInterval(id);
  }, [socket, sessionId]);

  useEffect(() => {
    autoStartedRef.current = false;
  }, [sessionId]);

  /** Instant lessons: trainer may request start once both are in (backend also auto-starts).
   *  Scheduled lessons: trainer starts manually unless backend auto-starts (late trainee). */
  useEffect(() => {
    if (accountType !== AccountType.TRAINER) return;
    if (!session?.is_instant) return;
    if (!socket?.connected || !sessionId) return;
    if (!(bothUsersJoined || participantsConnected) || !timerBufferElapsed) return;
    if (status !== "waiting") return;
    if (authoritativeTimer?.remainingSeconds != null) return;
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    requestStart();
  }, [
    accountType,
    session?.is_instant,
    socket,
    sessionId,
    bothUsersJoined,
    participantsConnected,
    timerBufferElapsed,
    status,
    authoritativeTimer?.remainingSeconds,
    requestStart,
    retryToken,
  ]);

  /** Track the moment both users joined — used as the local fallback anchor
   *  so the fallback countdown lines up with the trainer-auto-start path. */
  useEffect(() => {
    if (bothUsersJoined && bothJoinedAtRef.current == null) {
      bothJoinedAtRef.current = Date.now();
    } else if (!bothUsersJoined) {
      bothJoinedAtRef.current = null;
    }
  }, [bothUsersJoined]);

  /** Local fallback countdown. Mirrors the web behaviour at
   *  `portrait-calling/index.jsx` (~line 2722): only runs when the backend
   *  TIMER_STARTED event has NOT yet given us authoritative seconds, both
   *  peers are present, and the 5s buffer has elapsed. The authoritative
   *  socket value always wins the moment it arrives. */
  useEffect(() => {
    const stopFallback = () => {
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };

    if (authoritativeTimer?.remainingSeconds != null) {
      stopFallback();
      setFallbackRemainingSeconds(null);
      return stopFallback;
    }
    if (!bothUsersJoined || !timerBufferElapsed) {
      stopFallback();
      setFallbackRemainingSeconds(null);
      return stopFallback;
    }
    const durationSeconds = deriveDurationSeconds(session ?? null);
    if (!durationSeconds || durationSeconds <= 0) {
      stopFallback();
      setFallbackRemainingSeconds(null);
      return stopFallback;
    }

    const anchor =
      (bothJoinedAtRef.current ?? Date.now()) + TIMER_BUFFER_SECONDS * 1000;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - anchor) / 1000);
      const remaining = Math.max(
        0,
        Math.min(durationSeconds, durationSeconds - elapsed)
      );
      setFallbackRemainingSeconds(remaining);
      if (remaining <= 0) stopFallback();
    };
    tick();
    fallbackIntervalRef.current = setInterval(tick, 1000);
    return stopFallback;
  }, [
    session,
    bothUsersJoined,
    timerBufferElapsed,
    authoritativeTimer?.remainingSeconds,
  ]);

  const authoritativeRemaining = authoritativeTimer?.remainingSeconds ?? null;
  const effectiveRemaining =
    authoritativeRemaining != null ? authoritativeRemaining : fallbackRemainingSeconds;

  const bothConnectedFromSync =
    participantsConnected ||
    (trainerConnectedFromState != null &&
      traineeConnectedFromState != null &&
      trainerConnectedFromState &&
      traineeConnectedFromState);

  return {
    /** What the UI should render — authoritative socket value when available,
     *  otherwise the local fallback we derived from session start/end. */
    remainingSeconds: effectiveRemaining,
    /** True while we're displaying the local fallback (no authoritative
     *  value yet). UIs can show a subtle "syncing…" hint. */
    isAuthoritative: authoritativeRemaining != null,
    status,
    authoritativeTimer,
    participantsConnected,
    trainerConnected: trainerConnectedFromState,
    traineeConnected: traineeConnectedFromState,
    bothConnectedFromSync,
    requestStart,
    requestPause,
    requestResume,
  };
}
