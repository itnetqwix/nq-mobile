/**
 * Runtime camera + mic permission helper. Wraps `react-native-permissions` so
 * the rest of the calling stack can `await ensureCallPermissions()` and forget
 * about iOS vs. Android plumbing.
 *
 * iOS permission strings ship via the Expo config plugin (see `app.json` →
 * `@config-plugins/react-native-webrtc`). Android permission *declarations*
 * also live in `app.json` (`android.permissions`); we still must request the
 * runtime grants at call time.
 */

import { Platform } from "react-native";
import {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  type Permission,
} from "react-native-permissions";

type Grant = "granted" | "denied" | "blocked" | "unsupported";

async function ensure(permission: Permission): Promise<Grant> {
  try {
    const status = await check(permission);
    if (status === RESULTS.GRANTED) return "granted";
    if (status === RESULTS.UNAVAILABLE) return "unsupported";
    if (status === RESULTS.BLOCKED) return "blocked";
    const next = await request(permission);
    if (next === RESULTS.GRANTED) return "granted";
    if (next === RESULTS.BLOCKED) return "blocked";
    return "denied";
  } catch {
    return "denied";
  }
}

export type CallPermissions = {
  camera: Grant;
  microphone: Grant;
  allGranted: boolean;
};

export async function ensureCallPermissions(): Promise<CallPermissions> {
  const camPerm =
    Platform.OS === "ios"
      ? PERMISSIONS.IOS.CAMERA
      : PERMISSIONS.ANDROID.CAMERA;
  const micPerm =
    Platform.OS === "ios"
      ? PERMISSIONS.IOS.MICROPHONE
      : PERMISSIONS.ANDROID.RECORD_AUDIO;

  const [camera, microphone] = await Promise.all([
    ensure(camPerm),
    ensure(micPerm),
  ]);

  return {
    camera,
    microphone,
    allGranted: camera === "granted" && microphone === "granted",
  };
}
