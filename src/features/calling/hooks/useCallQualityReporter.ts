/**
 * Periodic call quality telemetry for ops dashboards (web `callQualityMonitor` parity).
 */

import { useEffect, useRef } from "react";
import { reportOpsEvent } from "../../ops/opsEventsApi";

type Args = {
  enabled: boolean;
  sessionId?: string;
  getNetworkStats: () => Promise<{
    rttMs: number | null;
    jitterMs: number | null;
    packetLossPct: number | null;
    iceConnectionState: string;
  }>;
  intervalMs?: number;
};

export function useCallQualityReporter({
  enabled,
  sessionId,
  getNetworkStats,
  intervalMs = 10_000,
}: Args) {
  const lastEmitRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const emit = async () => {
      const stats = await getNetworkStats();
      if (cancelled) return;
      const now = Date.now();
      if (now - lastEmitRef.current < intervalMs - 500) return;
      lastEmitRef.current = now;
      reportOpsEvent({
        event_type: "CALL_QUALITY_STATS",
        category: "call",
        severity: "info",
        session_id: sessionId,
        title: "Call quality sample",
        payload: stats as Record<string, unknown>,
        correlation_id: sessionId,
      });
    };

    void emit();
    const id = setInterval(emit, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, getNetworkStats, intervalMs, sessionId]);
}
