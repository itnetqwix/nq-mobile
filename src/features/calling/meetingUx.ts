import type { PresenceBannerVariant } from "./useSessionPresence";

export type MeetingStatusBanner = {
  message: string;
  variant: PresenceBannerVariant;
} | null;

type BannerInput = {
  cameraRevoked: boolean;
  partnerReconnecting: boolean;
  partnerInSession: boolean;
  hasRemoteStream: boolean;
  partnerDisconnected: boolean;
  peerDisplayName: string;
  isTrainer: boolean;
  trainerConnected: boolean | null;
  traineeConnected: boolean | null;
  bothJoined: boolean;
  presenceMessage: string | null;
  presenceVariant: PresenceBannerVariant;
  extensionPausedHint?: string | null;
  networkOffline?: boolean;
};

/**
 * One banner at a time — priority: camera > reconnecting > connecting video >
 * waiting / presence copy.
 */
export function resolveMeetingStatusBanner(input: BannerInput): MeetingStatusBanner {
  if (input.cameraRevoked) {
    return {
      message:
        "Camera access is off. Open Settings to turn the camera back on for this lesson.",
      variant: "warning",
    };
  }
  if (input.networkOffline) {
    return {
      message:
        "No internet connection. Reconnect to restore video — your lesson stays active during short outages.",
      variant: "warning",
    };
  }
  if (input.partnerReconnecting) {
    return {
      message: `${input.peerDisplayName} is reconnecting…`,
      variant: "warning",
    };
  }
  if (input.partnerInSession && !input.hasRemoteStream && !input.partnerDisconnected) {
    return {
      message: "Connecting live video…",
      variant: "info",
    };
  }
  if (!input.partnerInSession) {
    if (
      !input.isTrainer &&
      input.trainerConnected &&
      !input.bothJoined
    ) {
      return {
        message: "Your coach is in the lesson — connecting live video…",
        variant: "info",
      };
    }
    if (input.isTrainer && input.traineeConnected === false) {
      return {
        message: `${input.peerDisplayName} is still joining. Video and timer start when you are both connected.`,
        variant: "info",
      };
    }
    return {
      message: `Waiting for ${input.peerDisplayName} to join…`,
      variant: "info",
    };
  }
  if (input.presenceMessage) {
    return {
      message: input.presenceMessage,
      variant: input.presenceVariant,
    };
  }
  if (input.extensionPausedHint) {
    return {
      message: input.extensionPausedHint,
      variant: "warning",
    };
  }
  return null;
}

/** Precall network probe → simple label for non-technical users. */
export function precallNetworkLabel(
  quality: "fast" | "good" | "weak" | "unknown",
  loading: boolean
): string {
  if (loading) return "Checking…";
  if (quality === "fast") return "Great for video";
  if (quality === "good") return "OK for video";
  if (quality === "weak") return "Weak — move closer to Wi‑Fi";
  return "Unknown";
}
