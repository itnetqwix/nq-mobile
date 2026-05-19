/**
 * Session presence — socket room join/leave/reconnect (backend-authoritative).
 * Mirrors web `portrait-calling/index.jsx` PARTICIPANT_LEFT / STATUS / STALE.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

export type PartnerRole = "trainer" | "trainee";
export type PresenceBannerVariant = "info" | "warning" | "success";

export type SessionPresenceState = {
  /** From LESSON_STATE_SYNC when available; falls back to undefined until first sync. */
  trainerConnected: boolean | null;
  traineeConnected: boolean | null;
  partnerConnected: boolean;
  partnerLeftKind: PartnerRole | null;
  presenceMessage: string | null;
  presenceVariant: PresenceBannerVariant;
  partnerReconnecting: boolean;
};

type Args = {
  socket: Socket | null;
  sessionId: string;
  peerId: string;
  isTrainer: boolean;
  peerDisplayName: string;
  /** WebRTC/media connected — used only until first LESSON_STATE_SYNC arrives. */
  mediaPartnerJoined?: boolean;
};

const TIMER_STATE_SYNC = "LESSON_STATE_SYNC";

function partnerRoleFromPayload(role: unknown): PartnerRole | null {
  const r = String(role ?? "").toLowerCase();
  if (r === "trainer" || r === "coach") return "trainer";
  if (r === "trainee" || r === "student" || r === "user") return "trainee";
  return null;
}

function partnerLabel(isTrainer: boolean, kind: PartnerRole): string {
  if (kind === "trainer") return "Your coach";
  if (kind === "trainee") return "Your trainee";
  return isTrainer ? "Your trainee" : "Your coach";
}

export function useSessionPresence({
  socket,
  sessionId,
  peerId,
  isTrainer,
  peerDisplayName,
  mediaPartnerJoined = false,
}: Args): SessionPresenceState {
  const [trainerConnected, setTrainerConnected] = useState<boolean | null>(null);
  const [traineeConnected, setTraineeConnected] = useState<boolean | null>(null);
  const [partnerLeftKind, setPartnerLeftKind] = useState<PartnerRole | null>(null);
  const [presenceMessage, setPresenceMessage] = useState<string | null>(null);
  const [presenceVariant, setPresenceVariant] =
    useState<PresenceBannerVariant>("info");
  const [partnerReconnecting, setPartnerReconnecting] = useState(false);

  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStaleTimer = useCallback(() => {
    if (staleTimerRef.current) {
      clearTimeout(staleTimerRef.current);
      staleTimerRef.current = null;
    }
  }, []);

  const showSuccessThenClear = useCallback((msg: string, ms = 5000) => {
    if (successDismissRef.current) clearTimeout(successDismissRef.current);
    setPresenceMessage(msg);
    setPresenceVariant("success");
    successDismissRef.current = setTimeout(() => {
      setPresenceMessage(null);
      successDismissRef.current = null;
    }, ms);
  }, []);

  const partnerRole: PartnerRole | null = isTrainer ? "trainee" : "trainer";

  const hasPresenceSync = trainerConnected != null && traineeConnected != null;
  const partnerConnectedFromSocket = hasPresenceSync
    ? isTrainer
      ? !!traineeConnected
      : !!trainerConnected
    : mediaPartnerJoined;

  const partnerConnected =
    partnerConnectedFromSocket && partnerLeftKind == null && !partnerReconnecting;

  useEffect(() => {
    if (!socket || !sessionId) return;

    const matchesSession = (payload: { sessionId?: string }) =>
      payload?.sessionId != null && String(payload.sessionId) === String(sessionId);

    const isPeer = (userId?: string) =>
      userId != null && String(userId) === String(peerId);

    const handleStateSync = (state: {
      sessionId?: string;
      trainerConnected?: boolean;
      traineeConnected?: boolean;
    }) => {
      if (!matchesSession(state)) return;
      if (typeof state.trainerConnected === "boolean") {
        setTrainerConnected(state.trainerConnected);
      }
      if (typeof state.traineeConnected === "boolean") {
        setTraineeConnected(state.traineeConnected);
      }
    };

    const handleStatusChanged = (payload: {
      sessionId?: string;
      role?: string;
      status?: string;
      userId?: string;
    }) => {
      if (!matchesSession(payload)) return;
      const role = partnerRoleFromPayload(payload.role);
      if (!role || role !== partnerRole) return;
      if (!isPeer(payload.userId)) return;

      if (payload.status === "connected") {
        setPartnerReconnecting(false);
        clearStaleTimer();
        setPartnerLeftKind((prev) => {
          if (prev != null) {
            showSuccessThenClear(`${peerDisplayName} rejoined the session.`);
          } else {
            setPresenceMessage(
              `${peerDisplayName} joined the session. Please join if you haven't yet.`
            );
            setPresenceVariant("info");
          }
          return null;
        });
        if (role === "trainer") setTrainerConnected(true);
        else setTraineeConnected(true);
        return;
      }

      if (payload.status === "disconnected") {
        setPartnerReconnecting(false);
        setPartnerLeftKind(role);
        if (role === "trainer") {
          setTrainerConnected(false);
          setPresenceMessage(
            `${partnerLabel(isTrainer, role)} left — lesson timer paused. Waiting for them to rejoin…`
          );
        } else {
          setTraineeConnected(false);
          setPresenceMessage(
            `${peerDisplayName} left the session — timer is still running.`
          );
        }
        setPresenceVariant("warning");
      }
    };

    const handleParticipantLeft = (payload: {
      sessionId?: string;
      role?: string;
      userId?: string;
    }) => {
      if (!matchesSession(payload)) return;
      const role = partnerRoleFromPayload(payload.role);
      if (!role || role !== partnerRole) return;
      if (payload.userId && !isPeer(payload.userId)) return;

      setPartnerLeftKind(role);
      setPartnerReconnecting(false);
      if (role === "trainer") {
        setTrainerConnected(false);
        setPresenceMessage(
          `${partnerLabel(isTrainer, role)} has left the session. The timer has been paused. Waiting for them to rejoin…`
        );
      } else {
        setTraineeConnected(false);
        setPresenceMessage(
          `${peerDisplayName} has left the session. The timer is still running.`
        );
      }
      setPresenceVariant("warning");
    };

    const handleStale = () => {
      clearStaleTimer();
      setPartnerReconnecting(true);
      setPresenceMessage(
        `${peerDisplayName} may have lost connection. Waiting for them to reconnect…`
      );
      setPresenceVariant("warning");
      staleTimerRef.current = setTimeout(() => {
        staleTimerRef.current = null;
        setPartnerReconnecting(false);
      }, 15_000);
    };

    const requestState = () => {
      socket.emit("LESSON_STATE_REQUEST", { sessionId });
    };

    socket.emit("LESSON_STATE_REQUEST", { sessionId });
    socket.on(TIMER_STATE_SYNC, handleStateSync);
    socket.on("PARTICIPANT_STATUS_CHANGED", handleStatusChanged);
    socket.on("PARTICIPANT_LEFT", handleParticipantLeft);
    socket.on("PARTICIPANT_STALE", handleStale);
    socket.on("connect", requestState);
    socket.on("reconnect", requestState);

    return () => {
      clearStaleTimer();
      if (successDismissRef.current) clearTimeout(successDismissRef.current);
      socket.off(TIMER_STATE_SYNC, handleStateSync);
      socket.off("PARTICIPANT_STATUS_CHANGED", handleStatusChanged);
      socket.off("PARTICIPANT_LEFT", handleParticipantLeft);
      socket.off("PARTICIPANT_STALE", handleStale);
      socket.off("connect", requestState);
      socket.off("reconnect", requestState);
    };
  }, [
    socket,
    sessionId,
    peerId,
    isTrainer,
    peerDisplayName,
    partnerRole,
    clearStaleTimer,
    showSuccessThenClear,
  ]);

  return {
    trainerConnected,
    traineeConnected,
    partnerConnected,
    partnerLeftKind,
    presenceMessage,
    presenceVariant,
    partnerReconnecting,
  };
}
