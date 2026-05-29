import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { check, PERMISSIONS, RESULTS, type Permission } from "react-native-permissions";
import { Platform } from "react-native";

type Grant = "granted" | "denied" | "blocked";

async function checkOne(permission: Permission): Promise<Grant> {
  try {
    const status = await check(permission);
    if (status === RESULTS.GRANTED) return "granted";
    if (status === RESULTS.BLOCKED) return "blocked";
    return "denied";
  } catch {
    return "denied";
  }
}

/**
 * Re-check camera/mic while in-call (user may revoke in Settings mid-lesson).
 */
export function useInCallPermissions(enabled: boolean) {
  const [cameraRevoked, setCameraRevoked] = useState(false);
  const [micRevoked, setMicRevoked] = useState(false);
  const appState = useRef(AppState.currentState);

  const probe = useCallback(async () => {
    const camPerm =
      Platform.OS === "ios"
        ? PERMISSIONS.IOS.CAMERA
        : PERMISSIONS.ANDROID.CAMERA;
    const micPerm =
      Platform.OS === "ios"
        ? PERMISSIONS.IOS.MICROPHONE
        : PERMISSIONS.ANDROID.RECORD_AUDIO;
    const [camera, microphone] = await Promise.all([
      checkOne(camPerm),
      checkOne(micPerm),
    ]);
    setCameraRevoked(camera !== "granted");
    setMicRevoked(microphone !== "granted");
  }, []);

  useEffect(() => {
    if (!enabled) {
      setCameraRevoked(false);
      setMicRevoked(false);
      return;
    }
    void probe();
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        void probe();
      }
      appState.current = next;
    });
    const id = setInterval(() => void probe(), 12_000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, [enabled, probe]);

  return { cameraRevoked, micRevoked, recheckPermissions: probe };
}
