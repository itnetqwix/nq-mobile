/**
 * Runtime checks for whether the native WebRTC stack can run.
 * Expo Go does not ship react-native-webrtc — use a dev client or EAS build.
 */

import Constants from "expo-constants";
import { Platform } from "react-native";

/** True when running inside the Expo Go app (not a custom dev client / store build). */
export function isExpoGoRuntime(): boolean {
  if (Platform.OS === "web") return false;
  if (Constants.appOwnership === "expo") return true;
  if (Constants.executionEnvironment === "storeClient") return true;
  return false;
}

/** Best-effort: verify the WebRTC native module is linked. */
export function isWebRTCModuleLinked(): boolean {
  if (Platform.OS === "web") return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webrtc = require("react-native-webrtc");
    return typeof webrtc?.RTCPeerConnection === "function";
  } catch {
    return false;
  }
}

export function canUseNativeCallStack(): boolean {
  if (isExpoGoRuntime()) return false;
  return isWebRTCModuleLinked();
}

export function getNativeCallUnavailableMessage(): {
  title: string;
  body: string;
  hint: string;
} {
  if (isExpoGoRuntime()) {
    return {
      title: "Native video lessons need a dev build",
      body:
        "You opened this app in Expo Go. Instant and scheduled lessons use fully native in-app video (like Google Meet), not a web page inside the app.",
      hint: "After installing the dev build, join the lesson again — all UI (camera, clips, timer) runs in the app.",
    };
  }
  if (!isWebRTCModuleLinked()) {
    return {
      title: "Native video is not available",
      body:
        "This install does not include the WebRTC native module. Rebuild with expo prebuild / run:ios / run:android.",
      hint: "",
    };
  }
  return {
    title: "Unable to start lesson",
    body: "Native calling could not be started on this device.",
    hint: "",
  };
}
