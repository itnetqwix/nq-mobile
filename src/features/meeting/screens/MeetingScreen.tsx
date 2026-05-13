import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../navigation/types";
import { getAccessToken, getAccountType } from "../../auth/session/tokenStorage";
import { AccountType } from "../../../constants/accountType";
import { fetchScheduledMeetings } from "../../home/api/homeApi";
import { PortraitCallOverlay } from "../../calling/components/PortraitCallOverlay";
import { useLessonCountdown } from "../../calling/useLessonCountdown";
import type { CallParticipant } from "../../calling/types";

const NAVY = "#000080";
const WEB_ORIGIN = "https://www.netqwix.com";

type Props = NativeStackScreenProps<RootStackParamList, "Meeting">;

/**
 * Locate a session by id across the upcoming/confirmed lists already cached by React
 * Query. Used to drive the native portrait-calling overlay (peer name, avatar, countdown).
 */
function useSessionPeer(lessonId: string, accountType: string | null) {
  const queryClient = useQueryClient();

  /** Pull from cache first to avoid an extra round-trip when the user came from
   *  UpcomingSessionsScreen — fallback to fresh fetches if not cached. */
  const cached = useMemo(() => {
    const caches = queryClient.getQueriesData<any[]>({ queryKey: ["sessions"] });
    for (const [, list] of caches) {
      if (!Array.isArray(list)) continue;
      const hit = list.find((s) => String(s?._id) === String(lessonId));
      if (hit) return hit;
    }
    return null;
  }, [queryClient, lessonId]);

  const { data: fetched } = useQuery({
    queryKey: ["sessionLookup", lessonId],
    enabled: !cached && !!lessonId,
    queryFn: async () => {
      const [upcoming, confirmed] = await Promise.all([
        fetchScheduledMeetings("upcoming").catch(() => []),
        fetchScheduledMeetings("confirmed").catch(() => []),
      ]);
      return [...upcoming, ...confirmed].find(
        (s) => String(s?._id) === String(lessonId)
      );
    },
    staleTime: 30_000,
  });

  const session = cached ?? fetched ?? null;
  const isTrainer = accountType === AccountType.TRAINER;
  const peer: CallParticipant = useMemo(() => {
    const other = isTrainer ? session?.trainee_info : session?.trainer_info;
    return {
      _id: String(other?._id ?? ""),
      fullname: other?.fullname,
      fullName: other?.fullName,
      profile_picture: other?.profile_picture,
    };
  }, [session, isTrainer]);

  return { session, peer };
}

export function MeetingScreen({ navigation, route }: Props) {
  const { lessonId } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    (async () => {
      const [t, at] = await Promise.all([getAccessToken(), getAccountType()]);
      setToken(t);
      setAccountType(at);
    })();
  }, []);

  const { session, peer } = useSessionPeer(lessonId, accountType);

  const { remainingLabel, expired } = useLessonCountdown({
    bookedDate: session?.booked_date,
    sessionEndTime:
      session?.extended_session_end_time || session?.session_end_time,
  });

  /**
   * Web parity: `MeetingPage` reads `router.query.id` (see
   * `nq-frontend-main/app/features/meeting/MeetingPage.jsx:126`). It does NOT read
   * `lessonId`. Sending `?lessonId=...` left the embedded page stuck on
   * "Loading your profile..." because `getScheduledMeetingDetailsAsync({ id })` never
   * fired and `accountType` never got set, so the trainer/trainee never reached the
   * portrait-calling stack that emits `ON_CALL_JOIN` to the peer.
   */
  const meetingUrl = `${WEB_ORIGIN}/meeting?id=${lessonId}`;

  /**
   * Push the stored auth blob into the embedded site's localStorage so the website
   * meeting page authenticates as the same user.
   *
   * Hardening: the web reducer treats `""` as falsy and silently falls back to
   * `localStorage.getItem("acc_type")`. If we inject an empty string we just blank
   * out whatever was there. So:
   *   1. Always inject token (when present).
   *   2. Only overwrite acc_type when the device actually has a known role —
   *      otherwise leave whatever's already in the embedded localStorage alone.
   */
  const injectedJS = token
    ? `
      try {
        localStorage.setItem('token', ${JSON.stringify(token)});
        ${
          accountType
            ? `localStorage.setItem('acc_type', ${JSON.stringify(accountType)});`
            : `/* skip acc_type override — would otherwise wipe existing value */`
        }
      } catch(e) {}
      true;
    `
    : "true;";

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  };

  const confirmLeave = () => {
    Alert.alert(
      "Leave session?",
      "Are you sure you want to leave this lesson?",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: goHome,
        },
      ]
    );
  };

  if (!token) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <WebView
        ref={webViewRef}
        source={{ uri: meetingUrl }}
        injectedJavaScriptBeforeContentLoaded={injectedJS}
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        allowsFullscreenVideo
        /** Required for the embedded portrait-calling stack to grab camera + mic
         *  without re-prompting. iOS uses the WebKit grant type; Android relies on
         *  `onPermissionRequest` to auto-approve the WebRTC permission dialog. */
        mediaCapturePermissionGrantType={
          Platform.OS === "ios" ? "grant" : undefined
        }
        onError={(e) => console.warn("[Meeting] WebView error", e.nativeEvent)}
      />

      {/* Native overlay (peer info, countdown, leave button) sits on top of the WebView */}
      <PortraitCallOverlay
        peer={peer}
        countdownLabel={remainingLabel}
        countdownExpired={expired}
        onLeavePress={confirmLeave}
        onMinimize={goHome}
      />

      {loading && (
        <View style={[styles.loadingOverlay, { paddingTop: insets.top + 80 }]}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Connecting to session…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  webview: { flex: 1, backgroundColor: "#000" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
  },
  loadingText: { fontSize: 15, color: "#fff" },
});
