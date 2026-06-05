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

import { colorsLight } from "../../theme";

/** OS notification channel accent — stable brand navy (not theme-scoped). */
const NOTIFICATION_LED_COLOR = colorsLight.brandNavy;

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

/**
 * Just-in-time permission request.
 *
 * Pass a `reason` so we can decide whether to *ask* now vs. just read
 * the cached status. Callers should pass `reason` only when the user
 * has actually opted in to something that benefits from a push (e.g.
 * tapped "Notify me when slot opens", flipped a reminder switch).
 *
 * Calling this with no `reason` is a read-only check used by Settings.
 */
export async function ensureNotificationPermissions(
  reason?:
    | "booking_reminder"
    | "chat_message"
    | "instant_lesson"
    | "marketing"
    | "session_starting"
): Promise<PushPermissionStatus> {
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
  // Without a reason we never trigger the OS prompt — this is the
  // "settings UI just wants to read state" path.
  if (!reason) {
    return current.status === "denied" ? "denied" : "undetermined";
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

/**
 * High-level helper used by feature code at the moment of opt-in.
 * Returns true when push is now usable (registered or already was).
 *
 *   const ok = await requestPushPermissionForReason("booking_reminder");
 *   if (!ok) showOSSettingsDeepLink();
 */
export async function requestPushPermissionForReason(
  reason: Parameters<typeof ensureNotificationPermissions>[0]
): Promise<boolean> {
  const status = await ensureNotificationPermissions(reason);
  if (status !== "granted") return false;
  const result = await registerDevicePushToken();
  return !!result;
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
      lightColor: NOTIFICATION_LED_COLOR,
    });
    await Notifications.setNotificationChannelAsync("lessons", {
      name: "Lessons",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: NOTIFICATION_LED_COLOR,
    });
    /**
     * One channel per logical category — Android stacks notifications
     * sent to the same channel into a single visual group. The matching
     * iOS-side grouping happens via the `threadId` we send in the push
     * payload (see backend `notificationsService`).
     */
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
      lightColor: NOTIFICATION_LED_COLOR,
    });
    await Notifications.setNotificationChannelAsync("bookings", {
      name: "Bookings",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200],
      lightColor: NOTIFICATION_LED_COLOR,
    });
    await Notifications.setNotificationChannelAsync("payments", {
      name: "Payments",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
      lightColor: NOTIFICATION_LED_COLOR,
    });
    await Notifications.setNotificationChannelAsync("marketing", {
      name: "Promos & updates",
      importance: Notifications.AndroidImportance.LOW,
      lightColor: NOTIFICATION_LED_COLOR,
    });
  } catch {
    /** Channel setup is best-effort. */
  }
}

/**
 * Acquire a push token (Expo for managed delivery / native for direct FCM/APNs)
 * and register it with the backend. Safe to call multiple times — the backend
 * is expected to de-dupe by `deviceId`.
 *
 * **Does NOT trigger the OS permission prompt** — callers wanting that should
 * use {@link requestPushPermissionForReason}. This keeps the launch path
 * silent so we only ask after the user explicitly opts in to a notify-able
 * feature.
 */
export async function registerDevicePushToken(): Promise<RegisterTokenPayload | null> {
  if (!Device.isDevice) return null;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return null;

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
    const SecureStore = require("expo-secure-store");
    const token = await SecureStore.getItemAsync("nq.auth-token").catch(() => null);
    if (!token) return;
    await apiClient.delete(API_ROUTES.notifications.unregisterPushToken(deviceId));
  } catch (err: any) {
    if (__DEV__ && err?.response?.status !== 404 && err?.response?.status !== 401) {
      console.warn("[pushTokens] unregister failed", err?.message);
    }
  }
}
