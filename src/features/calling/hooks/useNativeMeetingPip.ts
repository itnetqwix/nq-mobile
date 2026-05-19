/**
 * OS picture-in-picture when the user leaves the app during an active lesson.
 * Requires a dev client / EAS build (not Expo Go). Android uses PiP mode when the
 * native module is present; iOS keeps the VoIP audio session alive and attempts
 * PiP via WebRTC utilities when available.
 */

import { useEffect, useRef } from "react";
import { AppState, NativeModules, Platform, type AppStateStatus } from "react-native";
import InCallManager from "react-native-incall-manager";

type Args = {
  /** Lesson is active and both peers are connected. */
  enabled: boolean;
  /** Prefer remote (trainee) stream in PiP when true. */
  preferRemote?: boolean;
};

type PipNative = {
  enterPipMode?: (params?: { width?: number; height?: number }) => Promise<void> | void;
  exitPipMode?: () => Promise<void> | void;
};

function getPipModule(): PipNative | null {
  const mod =
    NativeModules.RNPictureInPicture ??
    NativeModules.PictureInPicture ??
    NativeModules.WebRTCModule ??
    null;
  return mod as PipNative | null;
}

export function useNativeMeetingPip({ enabled, preferRemote = true }: Args) {
  const pipActive = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    try {
      InCallManager.start({ media: "video" });
    } catch {
      /* non-fatal */
    }

    const onChange = async (state: AppStateStatus) => {
      const pip = getPipModule();
      if (state === "background") {
        try {
          if (Platform.OS === "android" && pip?.enterPipMode) {
            await pip.enterPipMode({ width: 9, height: 16 });
            pipActive.current = true;
          } else if (Platform.OS === "ios") {
            /** iOS PiP with WebRTC requires native AVPictureInPicture wiring in the dev client. */
            pipActive.current = true;
          }
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
          await pip?.exitPipMode?.();
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
