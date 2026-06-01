import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
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
 * Application-level splash: keeps native splash visible until JS is ready,
 * plays branded animation, then hands off to navigation.
 */
export function AppBootstrapGate({ children, appInitReady = true }: Props) {
  const authStatus = useAppSelector(selectAuthStatus);
  const [phase, setPhase] = useState<BootstrapPhase>("splash");
  const [progress, setProgress] = useState(0.12);
  const bootStartedAt = useRef(Date.now());
  const finishTriggered = useRef(false);

  const authReady = authStatus !== "loading";

  useEffect(() => {
    if (authReady) {
      setProgress((p) => Math.max(p, 0.72));
    }
  }, [authReady]);

  useEffect(() => {
    if (appInitReady) {
      setProgress((p) => Math.max(p, 0.45));
    }
  }, [appInitReady]);

  const beginExit = useCallback(() => {
    if (finishTriggered.current) return;
    finishTriggered.current = true;
    setProgress(1);
    setPhase("exiting");
  }, []);

  useEffect(() => {
    if (!authReady || !appInitReady) return;

    const elapsed = Date.now() - bootStartedAt.current;
    const remaining = Math.max(0, SPLASH_MIN_DISPLAY_MS - elapsed);
    const timer = setTimeout(beginExit, remaining);
    return () => clearTimeout(timer);
  }, [authReady, appInitReady, beginExit]);

  useEffect(() => {
    const failsafe = setTimeout(beginExit, SPLASH_MAX_WAIT_MS);
    return () => clearTimeout(failsafe);
  }, [beginExit]);

  useEffect(() => {
    if (phase !== "exiting") return;
    const timer = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => {});
      setPhase("ready");
    }, SPLASH_EXIT_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "ready") {
    return <>{children}</>;
  }

  return (
    <View style={styles.shell}>
      <AppSplashScreen progress={progress} exiting={phase === "exiting"} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
});
