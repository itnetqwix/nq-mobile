/**
 * When the trainer loses network and the partner is disconnected for a sustained
 * period, pause the lesson timer so paid minutes are not consumed (trainer-only;
 * uses existing LESSON_TIMER_PAUSE_REQUEST / RESUME_REQUEST protocol).
 */

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import type { LessonTimerStatus } from "../useLessonTimer";

const OUTAGE_PAUSE_MS = 45_000;

type Args = {
  enabled: boolean;
  isTrainer: boolean;
  socket: Socket | null;
  sessionId: string;
  networkOnline: boolean;
  partnerDisconnected: boolean;
  timerStatus: LessonTimerStatus;
};

export function useLessonNetworkOutagePause({
  enabled,
  isTrainer,
  socket,
  sessionId,
  networkOnline,
  partnerDisconnected,
  timerStatus,
}: Args) {
  const outageSinceRef = useRef<number | null>(null);
  const pausedByOutageRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isTrainer || !socket) {
      outageSinceRef.current = null;
      return;
    }

    const inOutage = !networkOnline || partnerDisconnected;

    if (inOutage) {
      if (outageSinceRef.current == null) {
        outageSinceRef.current = Date.now();
      }
      const elapsed = Date.now() - outageSinceRef.current;
      if (
        elapsed >= OUTAGE_PAUSE_MS &&
        timerStatus === "running" &&
        !pausedByOutageRef.current
      ) {
        socket.emit("LESSON_TIMER_PAUSE_REQUEST", {
          sessionId,
          reason: "network_outage",
        });
        pausedByOutageRef.current = true;
      }
      return;
    }

    outageSinceRef.current = null;
    if (pausedByOutageRef.current && timerStatus === "paused") {
      socket.emit("LESSON_TIMER_RESUME_REQUEST", { sessionId });
      pausedByOutageRef.current = false;
    }
  }, [
    enabled,
    isTrainer,
    networkOnline,
    partnerDisconnected,
    sessionId,
    socket,
    timerStatus,
  ]);
}
