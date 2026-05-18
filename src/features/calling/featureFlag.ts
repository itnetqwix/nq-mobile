/**
 * Feature flag controlling whether the meeting screen mounts the new
 * `NativeMeetingScreen` (react-native-webrtc) or the legacy
 * `MeetingScreen` (WebView wrapping the production web meeting page).
 *
 * Web parity: the web meeting page uses PeerJS — our native engine does NOT.
 * Mobile <→ mobile is fully native; mobile <→ web is only safe via the WebView
 * fallback until the web side is migrated off PeerJS. Until then, we keep both
 * routes registered and pick at runtime.
 *
 * The flag is intentionally simple (a module-level const) so it can be flipped
 * to true once both ends are native or we ship the planned PeerJS shim. A more
 * dynamic source (Remote Config / per-user A/B) can replace this without
 * changing the consumer.
 */
import { Platform } from "react-native";

/**
 * Native WebRTC is the default for iOS/Android (requires dev client / EAS build
 * with react-native-webrtc — not Expo Go). Set `globalThis.NETQWIX_NATIVE_CALLS = false`
 * to force the legacy WebView meeting for QA.
 */
const DEFAULT_USE_NATIVE = true;

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var NETQWIX_NATIVE_CALLS: boolean | undefined;
}

export function shouldUseNativeMeeting(): boolean {
  if (Platform.OS === "web") return false;
  if (typeof globalThis !== "undefined" && globalThis.NETQWIX_NATIVE_CALLS != null) {
    return !!globalThis.NETQWIX_NATIVE_CALLS;
  }
  return DEFAULT_USE_NATIVE;
}
