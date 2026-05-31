/**
 * Graceful degradation: recover WebRTC when network returns or quality stays poor.
 */

import { useEffect, useRef } from "react";
import { useNetworkOnline } from "../../../lib/networkStatusStore";
import { reportOpsEvent } from "../../ops/opsEventsApi";
import { isPoorNetwork, type NetworkStatsSnapshot } from "../callQualityUtils";

type NetworkStats = NetworkStatsSnapshot;

type Args = {
  enabled: boolean;
  sessionId?: string;
  getNetworkStats: () => Promise<NetworkStats>;
  recoverConnection: () => void;
  /** Poll interval for quality sampling (ms). */
  pollMs?: number;
  /** Consecutive poor samples before forcing reconnect. */
  poorThreshold?: number;
};

export function useCallDegradation({
  enabled,
  sessionId,
  getNetworkStats,
  recoverConnection,
  pollMs = 10_000,
  poorThreshold = 3,
}: Args) {
  const online = useNetworkOnline();
  const wasOfflineRef = useRef(false);
  const poorStreakRef = useRef(0);
  const lastReportAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (!online) {
      wasOfflineRef.current = true;
      return;
    }
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      recoverConnection();
    }
  }, [enabled, online, recoverConnection]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      const stats = await getNetworkStats();
      if (cancelled) return;

      if (isPoorNetwork(stats)) {
        poorStreakRef.current += 1;
        const now = Date.now();
        if (now - lastReportAtRef.current > 60_000) {
          lastReportAtRef.current = now;
          reportOpsEvent({
            event_type: "CALL_QUALITY_STATS",
            category: "call",
            severity: "warning",
            session_id: sessionId,
            title: "Poor call quality detected",
            payload: stats as Record<string, unknown>,
            correlation_id: sessionId,
          });
        }
        if (poorStreakRef.current >= poorThreshold) {
          poorStreakRef.current = 0;
          recoverConnection();
        }
      } else {
        poorStreakRef.current = 0;
      }
    };

    void tick();
    const id = setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, getNetworkStats, pollMs, poorThreshold, recoverConnection, sessionId]);
}
