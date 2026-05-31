/**
 * OS picture-in-picture when the user leaves the app during an active lesson.
 * Requires a dev client / EAS build (not Expo Go).
 *
 * Android: `netqwix-meeting-native` enters PiP via PictureInPictureParams.
 * iOS: `MeetingIosPipHost` uses react-native-webrtc `iosPIP` on the remote stream.
 */

import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  enterMeetingPipMode,
  exitMeetingPipMode,
  isMeetingPipSupported,
} from "netqwix-meeting-native";

type Args = {
  /** Lesson is active and both peers are connected. */
  enabled: boolean;
  /** Prefer remote (trainee) stream in PiP when true (reserved for iOS WebRTC PiP). */
  preferRemote?: boolean;
};

export function useNativeMeetingPip({ enabled, preferRemote = true }: Args) {
  const pipActive = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const onChange = async (state: AppStateStatus) => {
      if (state === "background") {
        if (!isMeetingPipSupported()) return;
        try {
          const ok = await enterMeetingPipMode(9, 16);
          pipActive.current = ok;
        } catch (e) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn("[useNativeMeetingPip] enter failed", e);
          }
        }
        return;
      }

      if (state === "active" && pipActive.current) {
        try {
          await exitMeetingPipMode();
        } catch {
          /* ignore */
        }
        pipActive.current = false;
      }
    };

    const sub = AppState.addEventListener("change", onChange);
    return () => {
      sub.remove();
      pipActive.current = false;
    };
  }, [enabled, preferRemote]);
}
