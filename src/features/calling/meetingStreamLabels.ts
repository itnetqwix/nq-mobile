import type { CameraOffReason } from "./CallContext";

/** Label shown on PIP when video tile is off. */
export function streamOffHintForTile(args: {
  isStreamOff: boolean;
  isLocal: boolean;
  localCameraOffReason: CameraOffReason;
  remoteCameraOffReason: CameraOffReason;
  videoPausedForNetwork: boolean;
  partnerWeak: boolean;
}): string | undefined {
  if (!args.isStreamOff) return undefined;
  if (args.isLocal) {
    if (args.localCameraOffReason === "network" || args.videoPausedForNetwork) {
      return "Audio only (slow network)";
    }
    return "Camera off";
  }
  if (args.remoteCameraOffReason === "network" || args.partnerWeak) {
    return "Audio only (partner network)";
  }
  return "Camera off";
}
