import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { SESSION_DEPARTURE_SOCKET_EVENTS } from "../../lib/sessions/sessionContract";
import {
  fetchSessionDepartureStatus,
  raiseSessionDepartureConcern,
  respondSessionDeparture,
  type SessionDepartureStatus,
} from "../home/api/homeApi";

export type SessionDeparturePrompt = {
  sessionId: string;
  departedRole: "trainer" | "trainee";
  departedDisplayName: string;
  rejoinDeadlineAt: string | null;
  bookedEndAt: string | null;
};

type Args = {
  socket: Socket | null;
  sessionId: string;
  myUserId: string;
  isTrainer: boolean;
  onPartnerAcceptedEnd: () => void;
  onStayedActive: (status: SessionDepartureStatus) => void;
};

export function useSessionDeparture({
  socket,
  sessionId,
  myUserId,
  isTrainer,
  onPartnerAcceptedEnd,
  onStayedActive,
}: Args) {
  const [prompt, setPrompt] = useState<SessionDeparturePrompt | null>(null);
  const [status, setStatus] = useState<SessionDepartureStatus | null>(null);
  const [responding, setResponding] = useState(false);
  const [raisingConcern, setRaisingConcern] = useState(false);
  const [rejoinSecondsLeft, setRejoinSecondsLeft] = useState<number | null>(null);

  const onAcceptedRef = useRef(onPartnerAcceptedEnd);
  const onStayedRef = useRef(onStayedActive);
  onAcceptedRef.current = onPartnerAcceptedEnd;
  onStayedRef.current = onStayedActive;

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetchSessionDepartureStatus(sessionId);
      if (res?.departure) setStatus(res.departure);
      return res?.departure ?? null;
    } catch {
      return null;
    }
  }, [sessionId]);

  const applyPrompt = useCallback((payload: Partial<SessionDeparturePrompt>) => {
    if (!payload?.sessionId || String(payload.sessionId) !== String(sessionId)) return;
    setPrompt({
      sessionId: String(payload.sessionId),
      departedRole: (payload.departedRole as "trainer" | "trainee") ?? "trainer",
      departedDisplayName: String(payload.departedDisplayName ?? "Partner"),
      rejoinDeadlineAt: payload.rejoinDeadlineAt ?? null,
      bookedEndAt: payload.bookedEndAt ?? null,
    });
  }, [sessionId]);

  useEffect(() => {
    if (!socket || !sessionId) return;

    const onPrompt = (payload: SessionDeparturePrompt) => {
      applyPrompt(payload);
      void refreshStatus();
    };

    const onResolved = (payload: { sessionId?: string; acceptEnd?: boolean }) => {
      if (payload?.sessionId && String(payload.sessionId) !== String(sessionId)) return;
      setPrompt(null);
      if (payload?.acceptEnd) onAcceptedRef.current();
    };

    const onStayed = (payload: { sessionId?: string }) => {
      if (payload?.sessionId && String(payload.sessionId) !== String(sessionId)) return;
      setPrompt(null);
      void refreshStatus().then((s) => {
        if (s) onStayedRef.current(s);
      });
    };

    socket.on(SESSION_DEPARTURE_SOCKET_EVENTS.PROMPT, onPrompt);
    socket.on(SESSION_DEPARTURE_SOCKET_EVENTS.RESOLVED, onResolved);
    socket.on(SESSION_DEPARTURE_SOCKET_EVENTS.STAYED, onStayed);

    void refreshStatus().then((s) => {
      if (
        s?.pendingForUserId &&
        String(s.pendingForUserId) === String(myUserId) &&
        s.initiatedByRole
      ) {
        setPrompt({
          sessionId,
          departedRole: s.initiatedByRole,
          departedDisplayName: s.initiatedByRole === "trainer" ? "Your coach" : "Your trainee",
          rejoinDeadlineAt: s.rejoinDeadlineAt,
          bookedEndAt: s.bookedEndAt,
        });
      }
    });

    return () => {
      socket.off(SESSION_DEPARTURE_SOCKET_EVENTS.PROMPT, onPrompt);
      socket.off(SESSION_DEPARTURE_SOCKET_EVENTS.RESOLVED, onResolved);
      socket.off(SESSION_DEPARTURE_SOCKET_EVENTS.STAYED, onStayed);
    };
  }, [socket, sessionId, myUserId, applyPrompt, refreshStatus]);

  useEffect(() => {
    const deadline = status?.rejoinDeadlineAt ?? prompt?.rejoinDeadlineAt;
    if (!deadline || status?.stayedActiveAt == null) {
      setRejoinSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000)
      );
      setRejoinSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status?.rejoinDeadlineAt, status?.stayedActiveAt, prompt?.rejoinDeadlineAt]);

  const respond = useCallback(
    async (acceptEnd: boolean) => {
      setResponding(true);
      try {
        const res = await respondSessionDeparture(sessionId, acceptEnd);
        if (res?.departure) setStatus(res.departure);
        setPrompt(null);
        if (res?.ended) {
          onAcceptedRef.current();
        } else if (res?.departure) {
          onStayedRef.current(res.departure);
        }
      } finally {
        setResponding(false);
      }
    },
    [sessionId]
  );

  const raiseConcern = useCallback(async () => {
    setRaisingConcern(true);
    try {
      await raiseSessionDepartureConcern(sessionId);
      await refreshStatus();
    } finally {
      setRaisingConcern(false);
    }
  }, [sessionId, refreshStatus]);

  const showConcernButton =
    !isTrainer &&
    !!status?.canRaiseConcern &&
    !status?.concernRaisedAt;

  const waitingAfterDecline =
    !!status?.stayedActiveAt && !status?.pendingForUserId;

  return {
    prompt,
    status,
    responding,
    raisingConcern,
    rejoinSecondsLeft,
    showConcernButton,
    waitingAfterDecline,
    respond,
    raiseConcern,
    refreshStatus,
    clearPrompt: () => setPrompt(null),
  };
}
