import React, { Suspense, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../../navigation/types";
import { allowWebMeetingFallback, shouldUseNativeMeeting } from "../featureFlag";
import { NativeCallRequiredScreen } from "./NativeCallRequiredScreen";
import { PrecallLobbyScreen } from "./PrecallLobbyScreen";
import { setLastInterruptedSession } from "../callRejoinStore";
import { fetchLessonCallSlotStatus } from "../api/lessonCallSlotApi";

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
  const lessonId = props.route?.params?.lessonId ?? "";
  const skipLobby = Boolean(
    (props.route?.params as { skipLobby?: boolean } | undefined)?.skipLobby
  );
  const [joined, setJoined] = useState(false);
  const [rejoinChecking, setRejoinChecking] = useState(skipLobby);
  const [rejoinError, setRejoinError] = useState<string | null>(null);

  useEffect(() => {
    setUseNative(shouldUseNativeMeeting());
  }, []);

  const runRejoinSlotCheck = () => {
    if (!lessonId) return;
    setRejoinChecking(true);
    setRejoinError(null);
    void fetchLessonCallSlotStatus(lessonId)
      .then((slot) => {
        if (slot.canJoin || slot.canTakeOver) {
          setJoined(true);
        } else {
          props.navigation.goBack();
        }
      })
      .catch(() => {
        setRejoinError(
          "Could not verify this device for the lesson. Check your connection and try again."
        );
      })
      .finally(() => {
        setRejoinChecking(false);
      });
  };

  useEffect(() => {
    if (!skipLobby || !lessonId) return;
    runRejoinSlotCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, skipLobby]);

  if (skipLobby && rejoinChecking) {
    return <LoaderFallback />;
  }

  if (skipLobby && rejoinError) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.errorText}>{rejoinError}</Text>
        <Pressable style={styles.retryBtn} onPress={runRejoinSlotCheck}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
        <Pressable
          style={[styles.retryBtn, styles.cancelBtn]}
          onPress={() => props.navigation.goBack()}
        >
          <Text style={styles.retryText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

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
    padding: 24,
    gap: 16,
  },
  errorText: {
    color: "#fff",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  cancelBtn: {
    backgroundColor: "transparent",
  },
  retryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
