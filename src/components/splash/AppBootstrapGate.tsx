import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { requireAppUnlock } from "../../features/auth/security/appUnlock";
import {
  markColdStartUnlockResult,
  resetColdStartUnlockState,
} from "../../features/auth/security/coldStartUnlock";
import { useAppSelector } from "../../store/hooks";
import { selectAuthStatus } from "../../store/selectors";
import { AppSplashScreen } from "./AppSplashScreen";
import {
  SPLASH_EXIT_ANIMATION_MS,
  SPLASH_MAX_WAIT_MS,
  SPLASH_MIN_DISPLAY_MS,
} from "./splashConstants";

SplashScreen.preventAutoHideAsync().catch(() => {
  /* Expo Go / web may not support native splash control */
});

type BootstrapPhase = "splash" | "exiting" | "ready";

type Props = {
  children: React.ReactNode;
  /** Parent signals locale / other one-time init finished. */
  appInitReady?: boolean;
};

/**
 * Single cold-start splash: auth restore + locale + biometric unlock all happen
 * behind the light-blue branded screen so the white in-app loader never stacks.
 */
export function AppBootstrapGate({ children, appInitReady = true }: Props) {
  const authStatus = useAppSelector(selectAuthStatus);
  const [phase, setPhase] = useState<BootstrapPhase>("splash");
  const [unlockHandled, setUnlockHandled] = useState(false);
  const bootStartedAt = useRef(Date.now());
  const finishTriggered = useRef(false);
  const nativeSplashHidden = useRef(false);

  const authReady = authStatus !== "loading";

  useEffect(() => {
    if (!nativeSplashHidden.current) {
      nativeSplashHidden.current = true;
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (authStatus === "loading") {
      setUnlockHandled(false);
      resetColdStartUnlockState();
      return;
    }

    if (authStatus !== "signedIn") {
      markColdStartUnlockResult(true);
      setUnlockHandled(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      const ok = await requireAppUnlock();
      if (!cancelled) {
        markColdStartUnlockResult(ok);
        setUnlockHandled(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const shellReady = authReady && appInitReady && unlockHandled;

  const beginExit = useCallback(() => {
    if (finishTriggered.current) return;
    finishTriggered.current = true;
    setPhase("exiting");
  }, []);

  useEffect(() => {
    if (!shellReady) return;

    const elapsed = Date.now() - bootStartedAt.current;
    const remaining = Math.max(0, SPLASH_MIN_DISPLAY_MS - elapsed);
    const timer = setTimeout(beginExit, remaining);
    return () => clearTimeout(timer);
  }, [shellReady, beginExit]);

  useEffect(() => {
    const failsafe = setTimeout(beginExit, SPLASH_MAX_WAIT_MS);
    return () => clearTimeout(failsafe);
  }, [beginExit]);

  useEffect(() => {
    if (phase !== "exiting") return;
    const timer = setTimeout(() => setPhase("ready"), SPLASH_EXIT_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "ready") {
    return <>{children}</>;
  }

  return (
    <View style={styles.shell}>
      <AppSplashScreen exiting={phase === "exiting"} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
});
