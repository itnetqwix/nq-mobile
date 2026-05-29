/**
 * Restores call + lesson state when the app returns to the foreground.
 * Web portrait-calling uses visibilitychange + online for the same purpose.
 */

import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { Socket } from "socket.io-client";

type Args = {
  enabled: boolean;
  socket: Socket | null;
  status: string;
  partnerDisconnected: boolean;
  recoverConnection: () => void;
  sessionId?: string;
};

export function useCallForegroundRecovery({
  enabled,
  socket,
  status,
  partnerDisconnected,
  recoverConnection,
  sessionId,
}: Args) {
  const statusRef = useRef(status);
  const partnerDisconnectedRef = useRef(partnerDisconnected);
  statusRef.current = status;
  partnerDisconnectedRef.current = partnerDisconnected;

  useEffect(() => {
    if (!enabled) return;

    const onActive = (next: AppStateStatus) => {
      if (next !== "active") return;
      const st = statusRef.current;
      if (st === "idle" || st === "ended" || st === "preparing") return;

      recoverConnection();

      if (socket?.connected && sessionId) {
        socket.emit("LESSON_STATE_REQUEST", { sessionId });
      }
    };

    const sub = AppState.addEventListener("change", onActive);
    return () => sub.remove();
  }, [enabled, recoverConnection, sessionId, socket]);
}
