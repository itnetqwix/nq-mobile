import React, { Suspense, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../../navigation/types";
import { allowWebMeetingFallback, shouldUseNativeMeeting } from "../featureFlag";
import { NativeCallRequiredScreen } from "./NativeCallRequiredScreen";
import { PrecallLobbyScreen } from "./PrecallLobbyScreen";
import { setLastInterruptedSession } from "../callRejoinStore";

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
 *
 * Wrapped in a tiny gate that shows the pre-call lobby on first entry —
 * camera preview, mic test, and a network probe — then swaps to the real
 * meeting once the user taps Join. When re-joining after a drop, the
 * `skipLobby` route param bypasses the lobby (tap-to-rejoin is supposed
 * to feel instant).
 */
export function MeetingRouter(props: Props) {
  const [useNative, setUseNative] = useState(shouldUseNativeMeeting());
  const webFallback = allowWebMeetingFallback();
  const lessonId = props.route?.params?.lessonId ?? "";
  const skipLobby = Boolean(
    (props.route?.params as { skipLobby?: boolean } | undefined)?.skipLobby
  );
  const [joined, setJoined] = useState(skipLobby);

  useEffect(() => {
    setUseNative(shouldUseNativeMeeting());
  }, []);

  if (!joined && lessonId) {
    return (
      <PrecallLobbyScreen
        lessonId={lessonId}
        onJoin={(prefs) => {
          setLastInterruptedSession(null);
          props.navigation.setParams({
            joinAudioOnly: !!prefs.joinAudioOnly,
          });
          setJoined(true);
        }}
        onCancel={() => props.navigation.goBack()}
      />
    );
  }

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
