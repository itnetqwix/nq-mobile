/**
 * Reports WebRTC quality to the lesson room via `CALL_QUALITY_STATS` so the
 * partner sees `LESSON_QUALITY_UPDATE` (web parity).
 */

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import {
  buildCallQualitySocketPayload,
  type NetworkStatsSnapshot,
} from "../callQualityUtils";

type Args = {
  enabled: boolean;
  socket: Socket | null;
  sessionId?: string;
  role: "trainer" | "trainee";
  getNetworkStats: () => Promise<NetworkStatsSnapshot>;
  intervalMs?: number;
};

export function useCallQualitySocketReporter({
  enabled,
  socket,
  sessionId,
  role,
  getNetworkStats,
  intervalMs = 10_000,
}: Args) {
  const lastEmitRef = useRef(0);

  useEffect(() => {
    if (!enabled || !socket || !sessionId) return;
    let cancelled = false;

    const emit = async () => {
      if (!socket.connected) return;
      const stats = await getNetworkStats();
      if (cancelled) return;
      const now = Date.now();
      if (now - lastEmitRef.current < intervalMs - 400) return;
      lastEmitRef.current = now;
      const payload = buildCallQualitySocketPayload(stats, role);
      socket.emit("CALL_QUALITY_STATS", {
        sessionId,
        role,
        stats: payload,
      });
    };

    void emit();
    const id = setInterval(() => void emit(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, getNetworkStats, intervalMs, role, sessionId, socket]);
}
