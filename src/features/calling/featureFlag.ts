/**
 * Native-only meetings on mobile. WebView meeting is disabled by default.
 */
import { Platform } from "react-native";

import { canUseNativeCallStack } from "./nativeCallAvailability";

/** Native WebRTC is the only supported meeting path for production mobile. */
const DEFAULT_USE_NATIVE = true;

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var NETQWIX_NATIVE_CALLS: boolean | undefined;
  /** QA only: allow legacy WebView meeting when native is unavailable. */
  // eslint-disable-next-line no-var, vars-on-top
  var NETQWIX_WEB_MEETING_FALLBACK: boolean | undefined;
}

export function shouldUseNativeMeeting(): boolean {
  if (Platform.OS === "web") return false;
  if (!canUseNativeCallStack()) return false;
  if (typeof globalThis !== "undefined" && globalThis.NETQWIX_NATIVE_CALLS != null) {
    return !!globalThis.NETQWIX_NATIVE_CALLS;
  }
  return DEFAULT_USE_NATIVE;
}

/** Legacy WebView meeting — off by default. Set globalThis.NETQWIX_WEB_MEETING_FALLBACK = true to enable. */
export function allowWebMeetingFallback(): boolean {
  return typeof globalThis !== "undefined" && !!globalThis.NETQWIX_WEB_MEETING_FALLBACK;
}
