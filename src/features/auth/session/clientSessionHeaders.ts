import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { sanitizeHttpHeaderValue } from "../../../lib/http/sanitizeHttpHeaders";

function stableDeviceId(): string {
  const c = Constants as { installationId?: string; sessionId?: string };
  return (
    c.installationId ??
    c.sessionId ??
    `${Platform.OS}-${Device.modelName ?? "device"}-${Device.osBuildId ?? "unknown"}`
  );
}

export function buildDeviceLabel(): string {
  const model = Device.modelName ?? (Platform.OS === "ios" ? "iPhone" : "Android device");
  const appName = Constants.expoConfig?.name ?? "NetQwix";
  return sanitizeHttpHeaderValue(`${model} - ${appName}`);
}

/** Headers sent on auth + API calls so the backend can label login sessions. */
export function getClientSessionHeaders(): Record<string, string> {
  const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
  return {
    "X-NQ-Client": "mobile",
    "X-NQ-Platform": platform,
    "X-NQ-Device-Label": buildDeviceLabel(),
    "X-NQ-Device-Id": sanitizeHttpHeaderValue(stableDeviceId()),
    "X-NQ-App-Version": sanitizeHttpHeaderValue(String(Constants.expoConfig?.version ?? "")),
  };
}
