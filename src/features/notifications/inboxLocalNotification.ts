/**
 * Present a system notification when the app receives an inbox event while
 * backgrounded. Foreground toasts are handled by NotificationToast.
 */
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import * as Device from "expo-device";

import { configureAndroidChannels } from "./pushTokens";

let channelsReady = false;

async function ensureChannels() {
  if (channelsReady) return;
  await configureAndroidChannels();
  channelsReady = true;
}

export async function presentInboxNotification(
  title: string,
  body?: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!Device.isDevice) return;
  if (AppState.currentState === "active") return;

  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;

  await ensureChannels();

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: body?.trim() || "Open NetQwix to view.",
        data: data ?? {},
        sound: true,
        ...(Platform.OS === "android" ? { channelId: "default" } : {}),
      },
      trigger: null,
    });
  } catch {
    /* best effort — push from server may still arrive */
  }
}
