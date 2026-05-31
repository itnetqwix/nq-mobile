/**
 * Shared WebRTC quality bucketing + socket payload (web `callQualityMonitor` parity).
 */

export type QualityBucket = "good" | "fair" | "poor" | "unknown";

export type NetworkStatsSnapshot = {
  rttMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
  iceConnectionState: string;
  /** True when media path uses TURN relay (web `callQualityMonitor` parity). */
  usingRelay?: boolean;
};

export function bucketizeNetworkQuality(stats: NetworkStatsSnapshot): QualityBucket {
  if (stats.iceConnectionState === "failed") return "poor";
  if (stats.iceConnectionState === "disconnected") return "poor";
  if (stats.rttMs == null && stats.packetLossPct == null) {
    return stats.iceConnectionState === "connected" ? "good" : "unknown";
  }
  const rtt = stats.rttMs ?? 0;
  const loss = stats.packetLossPct ?? 0;
  if (rtt > 280 || loss > 5) return "poor";
  if (rtt > 140 || loss > 1.5) return "fair";
  return "good";
}

export function qualityLabel(bucket: QualityBucket): string {
  switch (bucket) {
    case "good":
      return "Strong";
    case "fair":
      return "Okay";
    case "poor":
      return "Weak";
    default:
      return "Unknown";
  }
}

/** Build payload expected by backend `CALL_QUALITY_STATS` handler. */
export function buildCallQualitySocketPayload(
  stats: NetworkStatsSnapshot,
  role: "trainer" | "trainee"
) {
  const loss = stats.packetLossPct ?? 0;
  const rttMs = stats.rttMs ?? 0;
  const audioScore = Math.max(0, Math.min(100, 100 - loss * 8 - Math.max(0, rttMs - 80) * 0.15));
  const videoScore = Math.max(0, Math.min(100, audioScore - (loss > 2 ? 15 : 0)));
  const overallScore = Math.round((audioScore + videoScore) / 2);
  return {
    timestamp: Date.now(),
    role,
    quality: {
      audioScore,
      videoScore,
      overallScore,
      rtt: rttMs / 1000,
      usingRelay: !!stats.usingRelay,
    },
    connection: {
      rtt: rttMs / 1000,
      iceConnectionState: stats.iceConnectionState,
    },
  };
}

export function isPoorNetwork(stats: NetworkStatsSnapshot): boolean {
  return bucketizeNetworkQuality(stats) === "poor";
}
