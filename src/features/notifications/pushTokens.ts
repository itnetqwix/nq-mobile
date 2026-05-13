/**
 * Push token registration helpers
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps the `expo-notifications` token lifecycle for NetQwix:
 *
 *   • `ensureNotificationPermissions()` — request the OS permission once.
 *   • `registerDevicePushToken()` — fetch the device/expo push token and POST
 *     it to the backend so it can fan out lifecycle pushes (instant lesson
 *     accept, peer joined, time warnings, etc.).
 *   • `unregisterDevicePushToken()` — DELETE the token on sign-out.
 *
 * The backend endpoints land in Phase 4b backend work; until they exist the
 * client logs and gracefully no-ops so dev builds don't crash.
 */

import { colors } from "../../theme";

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";

/** Stable per-install identifier — Expo's `installationId` if available,
 *  otherwise a synthetic. Mirrors how the backend dedupes tokens per device. */
function getDeviceId(): string {
  // `Constants.installationId` was removed in SDK 49; the recommended
  // replacement is `Constants.sessionId` for ephemeral / `Application.androidId`
  // for stable. We compose a best-effort key.
  const c = Constants as any;
  return (
    c.installationId ??
    c.sessionId ??
    `${Platform.OS}-${Device.modelName ?? "device"}-${Device.osBuildId ?? "unknown"}`
  );
}

export type RegisterTokenPayload = {
  token: string;
  platform: "ios" | "android" | "web";
  deviceId: string;
  /** Expo push token vs raw native (`FCM` / `APNs`). */
  kind: "expo" | "native";
};

/** Surface a friendly status to the caller (Settings can show "push enabled"). */
export type PushPermissionStatus = "granted" | "denied" | "undetermined";

export async function ensureNotificationPermissions(): Promise<PushPermissionStatus> {
  /** Simulators don't have push entitlement — bail early so dev builds don't
   *  show a misleading "denied" status. */
  if (!Device.isDevice) return "undetermined";

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  if (
    current.status === "denied" &&
    current.canAskAgain === false
  ) {
    return "denied";
  }
  const next = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  if (next.granted) return "granted";
  return next.status === "denied" ? "denied" : "undetermined";
}

/** Android channel setup — must run once before showing any local
 *  notification, otherwise Android silently drops it. */
export async function configureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "General",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: colors.brandNavy,
    });
    await Notifications.setNotificationChannelAsync("lessons", {
      name: "Lessons",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: colors.brandNavy,
    });
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
      lightColor: colors.brandNavy,
    });
  } catch {
    /** Channel setup is best-effort. */
  }
}

/**
 * Acquire a push token (Expo for managed delivery / native for direct FCM/APNs)
 * and register it with the backend. Safe to call multiple times — the backend
 * is expected to de-dupe by `deviceId`.
 */
export async function registerDevicePushToken(): Promise<RegisterTokenPayload | null> {
  const perm = await ensureNotificationPermissions();
  if (perm !== "granted") return null;
  if (!Device.isDevice) return null;

  await configureAndroidChannels();

  const projectId =
    (Constants?.expoConfig as any)?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId;

  let token: string | null = null;
  let kind: "expo" | "native" = "expo";

  try {
    if (projectId) {
      const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
      token = expoToken.data;
      kind = "expo";
    } else {
      /** No EAS project id (typical for first-time setup) — fall back to the
       *  raw device token. Backend can ship straight to APNs/FCM with this. */
      const native = await Notifications.getDevicePushTokenAsync();
      token = String(native.data);
      kind = "native";
    }
  } catch (err) {
    if (__DEV__) {
      console.warn("[pushTokens] failed to get token", err);
    }
    return null;
  }

  if (!token) return null;

  const payload: RegisterTokenPayload = {
    token,
    platform: Platform.OS as RegisterTokenPayload["platform"],
    deviceId: getDeviceId(),
    kind,
  };

  try {
    await apiClient.post(API_ROUTES.notifications.registerPushToken, payload);
  } catch (err: any) {
    /** Backend endpoint is being added in Phase 4b; tolerate 404 so the app
     *  keeps working in mixed deploy states. */
    if (__DEV__ && err?.response?.status !== 404) {
      console.warn("[pushTokens] register failed", err?.message);
    }
  }

  return payload;
}

export async function unregisterDevicePushToken(): Promise<void> {
  const deviceId = getDeviceId();
  try {
    await apiClient.delete(API_ROUTES.notifications.unregisterPushToken(deviceId));
  } catch (err: any) {
    if (__DEV__ && err?.response?.status !== 404) {
      console.warn("[pushTokens] unregister failed", err?.message);
    }
  }
}
