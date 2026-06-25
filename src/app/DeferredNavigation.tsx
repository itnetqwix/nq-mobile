import React, { useEffect, useState } from "react";
import { InteractionManager, View } from "react-native";
import { NetQwixLoader } from "../components/brand/NetQwixLoader";
import { ThemedNavigationContainer } from "./ThemedNavigationContainer";

/**
 * Waits one frame + interaction pass before mounting React Navigation so the
 * splash hand-off does not race native screen setup on device builds.
 */
export function DeferredNavigation() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    const backup = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 400);

    const frame = requestAnimationFrame(() => {
      task = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) setReady(true);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      task?.cancel();
      clearTimeout(backup);
    };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1 }}>
        <NetQwixLoader
          message="Loading"
          variant="fullscreen"
          motion="quick"
          backdrop="solid"
        />
      </View>
    );
  }

  return <ThemedNavigationContainer />;
}
