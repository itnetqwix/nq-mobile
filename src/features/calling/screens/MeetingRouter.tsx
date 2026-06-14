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
import { fetchSessionJoinReadiness } from "../sessionLiveApi";
import { SessionRejoinBlockedModal } from "../components/SessionRejoinBlockedModal";

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
  const [rejoinBlockedReason, setRejoinBlockedReason] = useState<string | null>(null);

  useEffect(() => {
    setUseNative(shouldUseNativeMeeting());
  }, []);

  const runRejoinPreflight = () => {
    if (!lessonId) return;
    setRejoinChecking(true);
    setRejoinError(null);
    setRejoinBlockedReason(null);
    void fetchSessionJoinReadiness(lessonId)
      .then((readiness) => {
        if (!readiness) {
          setRejoinError("Could not load session status. Try again.");
          return;
        }
        if (readiness.can_join === false) {
          if (readiness.join_code === "departure_rejoin_blocked") {
            setRejoinBlockedReason(
              readiness.join_block_reason ??
                "You have another session during this time and cannot rejoin."
            );
            return;
          }
          setRejoinError(
            readiness.join_block_reason ?? "This session is not ready to join."
          );
          return;
        }
        if (readiness.call_slot?.canJoin === false && !readiness.call_slot?.canTakeOver) {
          props.navigation.goBack();
          return;
        }
        setJoined(true);
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
    runRejoinPreflight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, skipLobby]);

  if (skipLobby && rejoinChecking) {
    return <LoaderFallback />;
  }

  if (skipLobby && rejoinBlockedReason) {
    return (
      <>
        <LoaderFallback />
        <SessionRejoinBlockedModal
          visible
          reason={rejoinBlockedReason}
          onDismiss={() => props.navigation.goBack()}
        />
      </>
    );
  }

  if (skipLobby && rejoinError) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.errorText}>{rejoinError}</Text>
        <Pressable style={styles.retryBtn} onPress={runRejoinPreflight}>
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
