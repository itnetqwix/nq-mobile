import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Metro / Expo dev server host (e.g. `192.168.1.42` from `hostUri` `192.168.1.42:8081`). */
export function getMetroLanHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0]?.trim();
    if (host && host !== "localhost" && host !== "127.0.0.1") return host;
  }

  const constantsAny = Constants as {
    manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
    manifest?: { debuggerHost?: string };
  };
  const debuggerHost =
    constantsAny.manifest2?.extra?.expoGo?.debuggerHost ??
    constantsAny.manifest?.debuggerHost;
  if (debuggerHost) {
    const host = String(debuggerHost).split(":")[0]?.trim();
    if (host && host !== "localhost" && host !== "127.0.0.1") return host;
  }

  return null;
}

/**
 * In dev, `localhost` in `.env` points at the phone on a physical device.
 * Rewrite to Metro's LAN IP (or Android emulator `10.0.2.2`) so local backend works.
 */
export function resolveDevApiBaseUrl(url: string): string {
  if (!__DEV__) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const host = parsed.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") return url;

  if (Platform.OS === "android" && !Device.isDevice) {
    parsed.hostname = "10.0.2.2";
    return stripTrailingSlash(parsed.toString());
  }

  if (Platform.OS === "ios" && !Device.isDevice) {
    return url;
  }

  const metroHost = getMetroLanHost();
  if (metroHost) {
    parsed.hostname = metroHost;
    return stripTrailingSlash(parsed.toString());
  }

  return url;
}

export function isLocalDevApiHost(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === "localhost" || h === "127.0.0.1" || /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(h);
  } catch {
    return false;
  }
}
