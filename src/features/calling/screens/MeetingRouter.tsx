import React, { Suspense, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../../navigation/types";
import { allowWebMeetingFallback, shouldUseNativeMeeting } from "../featureFlag";
import { NativeCallRequiredScreen } from "./NativeCallRequiredScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Meeting">;

const LazyNativeMeetingScreen = React.lazy(() =>
  import("./NativeMeetingScreen")
    .then((mod) => {
      const Component = mod.NativeMeetingScreen;
      if (!Component) {
        throw new Error("NativeMeetingScreen export missing");
      }
      return { default: Component };
    })
    .catch((err) => {
      if (__DEV__) {
        console.warn(
          "[MeetingRouter] Native meeting failed to load:",
          err?.message ?? err
        );
      }
      return { default: NativeCallRequiredScreen };
    })
);

/** QA-only WebView path — lazy so Expo Go does not load WebView meeting by default. */
const LazyWebMeetingScreen = React.lazy(() =>
  import("../../meeting/screens/MeetingScreen").then((mod) => ({
    default: mod.MeetingScreen,
  }))
);

/**
 * Mobile lessons use native WebRTC only (NativeMeetingScreen).
 * Expo Go → NativeCallRequiredScreen (no embedded web meeting).
 */
export function MeetingRouter(props: Props) {
  const [useNative, setUseNative] = useState(shouldUseNativeMeeting());
  const webFallback = allowWebMeetingFallback();

  useEffect(() => {
    setUseNative(shouldUseNativeMeeting());
  }, []);

  if (useNative) {
    return (
      <Suspense fallback={<LoaderFallback />}>
        <LazyNativeMeetingScreen {...props} />
      </Suspense>
    );
  }

  if (webFallback) {
    return (
      <Suspense fallback={<LoaderFallback />}>
        <LazyWebMeetingScreen {...props} />
      </Suspense>
    );
  }

  return <NativeCallRequiredScreen {...props} />;
}

function LoaderFallback() {
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="large" color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
});
