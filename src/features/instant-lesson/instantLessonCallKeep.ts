/**
 * Native incoming-call UI via CallKit (iOS) and ConnectionService (Android).
 * Requires a dev build with react-native-callkeep — not available in Expo Go.
 *
 * Android: unpatched `react-native-callkeep` crashes under RN New Architecture
 * (duplicate `displayIncomingCall` / `startCall` @ReactMethod). We ship a patch in
 * `patches/`; rebuild the dev APK, then set `ANDROID_CALLKEEP_ENABLED` to true.
 */

import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import type { InstantLessonIncomingPayload } from "./instantLessonBridge";

type CallKeepModule = typeof import("react-native-callkeep").default;

let RNCallKeep: CallKeepModule | null | undefined;
let setupComplete = false;
let setupPromise: Promise<boolean> | null = null;

const lessonIdToCallUuid = new Map<string, string>();
const callUuidToPayload = new Map<string, InstantLessonIncomingPayload>();
const answeredCallUuids = new Set<string>();

const readyListeners = new Set<() => void>();

function notifyReadyListeners() {
  readyListeners.forEach((fn) => fn());
}

export function subscribeInstantLessonCallKeepReady(listener: () => void): () => void {
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

/** Set true after `npm run android:install-dev` (applies react-native-callkeep patch). */
const ANDROID_CALLKEEP_ENABLED = false;

/** CallKeep native module — iOS always; Android only after legacy-arch rebuild. */
export function isCallKeepNativeModuleSupported(): boolean {
  if (Platform.OS === "ios") return true;
  if (Platform.OS === "android" && ANDROID_CALLKEEP_ENABLED) return true;
  return false;
}

function loadCallKeep(): CallKeepModule | null {
  if (Platform.OS === "web" || !isCallKeepNativeModuleSupported()) {
    if (RNCallKeep === undefined) RNCallKeep = null;
    return null;
  }
  if (RNCallKeep !== undefined) return RNCallKeep;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RNCallKeep = require("react-native-callkeep").default as CallKeepModule;
    return RNCallKeep;
  } catch {
    RNCallKeep = null;
    return null;
  }
}

export function isInstantLessonCallKeepReady(): boolean {
  return setupComplete && loadCallKeep() != null;
}

export function shouldUseNativeIncomingCallUi(): boolean {
  return isInstantLessonCallKeepReady();
}

export function getInstantLessonCallUuid(lessonId: string): string | undefined {
  return lessonIdToCallUuid.get(lessonId);
}

export function getPayloadForCallUuid(
  callUuid: string
): InstantLessonIncomingPayload | undefined {
  return callUuidToPayload.get(callUuid);
}

export function markCallUuidAnswered(callUuid: string): void {
  answeredCallUuids.add(callUuid);
}

export function wasCallUuidAnswered(callUuid: string): boolean {
  return answeredCallUuids.has(callUuid);
}

export async function setupInstantLessonCallKeep(): Promise<boolean> {
  const ck = loadCallKeep();
  if (!ck) return false;
  if (setupComplete) return true;
  if (setupPromise) return setupPromise;

  setupPromise = (async () => {
    try {
      await ck.setup({
        ios: {
          appName: "NetQwix",
          supportsVideo: true,
          maximumCallGroups: "1",
          maximumCallsPerCallGroup: "1",
          includesCallsInRecents: false,
        },
        android: {
          alertTitle: "Phone account",
          alertDescription:
            "NetQwix uses the system call UI so you can accept instant lessons from the lock screen.",
          cancelButton: "Not now",
          okButton: "Enable",
          additionalPermissions: [],
          selfManaged: false,
          foregroundService: {
            channelId: "com.netqwix.app.callkeep",
            channelName: "Instant lesson calls",
            notificationTitle: "NetQwix",
            notificationIcon: "ic_launcher",
          },
        },
      });

      if (Platform.OS === "android") {
        await ck.setAvailable(true);
      }
      ck.setReachable();

      setupComplete = true;
      notifyReadyListeners();
      return true;
    } catch {
      setupComplete = false;
      return false;
    } finally {
      setupPromise = null;
    }
  })();

  return setupPromise;
}

export async function displayInstantLessonIncomingCall(
  payload: InstantLessonIncomingPayload
): Promise<boolean> {
  const ck = loadCallKeep();
  if (!ck || !setupComplete) return false;

  const lessonId = payload.lessonId;
  let callUuid = lessonIdToCallUuid.get(lessonId);
  if (!callUuid) {
    callUuid = Crypto.randomUUID();
    lessonIdToCallUuid.set(lessonId, callUuid);
    callUuidToPayload.set(callUuid, payload);
  } else {
    callUuidToPayload.set(callUuid, payload);
  }

  const traineeName = payload.traineeInfo?.fullname ?? "Trainee";
  const handle = lessonId.slice(-8);

  try {
    await ck.displayIncomingCall(
      callUuid,
      handle,
      traineeName,
      "generic",
      true
    );
    return true;
  } catch {
    lessonIdToCallUuid.delete(lessonId);
    callUuidToPayload.delete(callUuid);
    return false;
  }
}

export async function endInstantLessonCall(lessonId: string): Promise<void> {
  const ck = loadCallKeep();
  if (!ck) return;

  const callUuid = lessonIdToCallUuid.get(lessonId);
  if (!callUuid) return;

  try {
    await ck.endCall(callUuid);
  } catch {
    /* ignore */
  }

  lessonIdToCallUuid.delete(lessonId);
  callUuidToPayload.delete(callUuid);
  answeredCallUuids.delete(callUuid);
}

export async function endAllInstantLessonCalls(): Promise<void> {
  const ck = loadCallKeep();
  if (!ck) return;

  try {
    await ck.endAllCalls();
  } catch {
    /* ignore */
  }

  lessonIdToCallUuid.clear();
  callUuidToPayload.clear();
  answeredCallUuids.clear();
}

export async function rejectInstantLessonCall(lessonId: string): Promise<void> {
  const ck = loadCallKeep();
  if (!ck) return;

  const callUuid = lessonIdToCallUuid.get(lessonId);
  if (!callUuid) return;

  try {
    await ck.rejectCall(callUuid);
  } catch {
    try {
      await ck.endCall(callUuid);
    } catch {
      /* ignore */
    }
  }

  lessonIdToCallUuid.delete(lessonId);
  callUuidToPayload.delete(callUuid);
  answeredCallUuids.delete(callUuid);
}

export function getCallKeepModule(): CallKeepModule | null {
  return loadCallKeep();
}
