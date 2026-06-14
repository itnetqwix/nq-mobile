/**
 * Network tiers for live lessons — drives encoder limits, clip/drawing throttle,
 * and UI degradation (Meet/Zoom-style).
 */

export type LessonNetworkTier = "normal" | "fair" | "slow" | "offline";

export type LessonNetworkTierConfig = {
  maxVideoBitrate: number;
  videoWidth: number;
  videoHeight: number;
  maxFps: number;
  /** Min ms between clip progress socket emits (trainer). */
  clipProgressEmitMs: number;
  /** Min ms between DRAW emits (trainer); 0 = no extra throttle. */
  drawingEmitMinMs: number;
  /** Auto-hide local PIP in clip mode to reduce decode/upload pressure. */
  hideLocalPipInClipMode: boolean;
  /** Suggested ICE restart / full reconnect after sustained disconnect (ms). */
  iceRecoveryMs: number;
};

export const LESSON_NETWORK_TIER_CONFIG: Record<
  LessonNetworkTier,
  LessonNetworkTierConfig
> = {
  normal: {
    maxVideoBitrate: 900_000,
    videoWidth: 720,
    videoHeight: 1280,
    maxFps: 24,
    clipProgressEmitMs: 2500,
    drawingEmitMinMs: 16,
    hideLocalPipInClipMode: false,
    iceRecoveryMs: 28_000,
  },
  fair: {
    maxVideoBitrate: 450_000,
    videoWidth: 480,
    videoHeight: 640,
    maxFps: 20,
    clipProgressEmitMs: 5000,
    drawingEmitMinMs: 48,
    hideLocalPipInClipMode: true,
    iceRecoveryMs: 14_000,
  },
  slow: {
    maxVideoBitrate: 180_000,
    videoWidth: 320,
    videoHeight: 480,
    maxFps: 15,
    clipProgressEmitMs: 8000,
    drawingEmitMinMs: 120,
    hideLocalPipInClipMode: true,
    iceRecoveryMs: 10_000,
  },
  offline: {
    maxVideoBitrate: 0,
    videoWidth: 320,
    videoHeight: 480,
    maxFps: 12,
    clipProgressEmitMs: 12_000,
    drawingEmitMinMs: 200,
    hideLocalPipInClipMode: true,
    iceRecoveryMs: 8_000,
  },
};

export function tierFromLessonNetworkMode(
  mode: LessonNetworkTier
): LessonNetworkTier {
  return mode;
}

export function clipsMayLagMessage(mode: LessonNetworkTier): string | null {
  if (mode === "slow" || mode === "offline") {
    return "Clips may lag on this connection — audio and annotations still sync.";
  }
  if (mode === "fair") {
    return "Connection is fair — clip video may stutter briefly.";
  }
  return null;
}
