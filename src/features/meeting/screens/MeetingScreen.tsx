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
import { queryKeys } from "../../../lib/queryKeys";
import { fetchScheduledMeetings } from "../../home/api/homeApi";
import { PortraitCallOverlay } from "../../calling/components/PortraitCallOverlay";
import { SessionExtensionModal } from "../../calling/components/SessionExtensionModal";
import { useLessonTimer } from "../../calling/useLessonTimer";
import { useSessionExtensionFlow } from "../../calling/useSessionExtensionFlow";
import { useSocket } from "../../socket/SocketContext";
import { useAuth } from "../../auth/context/AuthContext";
import type { CallParticipant } from "../../calling/types";
import { reportOpsEvent } from "../../ops/opsEventsApi";

const NAVY = "#000080";
const WEB_ORIGIN = "https://www.netqwix.com";
const EXTEND_PROMPT_SECONDS = 120;

type Props = NativeStackScreenProps<RootStackParamList, "Meeting">;

function formatRemainingSeconds(seconds: number | null): {
  label: string;
  expired: boolean;
} {
  if (seconds == null) return { label: "—", expired: false };
  if (seconds <= 0) return { label: "0:00", expired: true };
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  const label =
    h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  return { label, expired: seconds <= 0 };
}

function useSessionPeer(lessonId: string, accountType: string | null) {
  const queryClient = useQueryClient();

  const cached = useMemo(() => {
    const caches = queryClient.getQueriesData<any[]>({ queryKey: queryKeys.sessions.all });
    for (const [, list] of caches) {
      if (!Array.isArray(list)) continue;
      const hit = list.find((s) => String(s?._id) === String(lessonId));
      if (hit) return hit;
    }
    return null;
  }, [queryClient, lessonId]);

  const { data: fetched } = useQuery({
    queryKey: queryKeys.sessions.lookup(lessonId),
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
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { accountType: authAccountType, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [timerBufferElapsed, setTimerBufferElapsed] = useState(false);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extensionNotice, setExtensionNotice] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    (async () => {
      const [t, at] = await Promise.all([getAccessToken(), getAccountType()]);
      setToken(t);
      setAccountType(at ?? authAccountType);
    })();
  }, [authAccountType]);

  useEffect(() => {
    const t = setTimeout(() => setTimerBufferElapsed(true), 5000);
    return () => clearTimeout(t);
  }, [lessonId]);

  const { session, peer } = useSessionPeer(lessonId, accountType);

  const { remainingSeconds, status, pendingExtensionRequest } = useLessonTimer({
    socket,
    sessionId: lessonId,
    bothUsersJoined: true,
    timerBufferElapsed,
    accountType,
    session,
  });

  const extensionFlow = useSessionExtensionFlow({
    socket,
    sessionId: lessonId,
    isTrainer: accountType === AccountType.TRAINER,
    myUserId: String((user as { _id?: string })?._id ?? ""),
    pendingFromSync: pendingExtensionRequest,
  });

  useEffect(() => {
    if (!socket) return;
    const onExtended = (data: any) => {
      if (!data || String(data.sessionId) !== String(lessonId)) return;
      const addedMin = Math.round((data.addedSeconds ?? 0) / 60);
      if (accountType === AccountType.TRAINER && addedMin > 0) {
        setExtensionNotice(`Trainee added +${addedMin} min to this lesson`);
        setTimeout(() => setExtensionNotice(null), 8000);
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.lookup(lessonId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
    };
    socket.on("LESSON_TIMER_EXTENDED", onExtended);
    return () => {
      socket.off("LESSON_TIMER_EXTENDED", onExtended);
    };
  }, [socket, lessonId, accountType, queryClient]);

  const { label: countdownLabel, expired: countdownExpired } = useMemo(
    () => formatRemainingSeconds(remainingSeconds),
    [remainingSeconds]
  );

  const isTrainee = accountType === AccountType.TRAINEE;
  const showExtendButton =
    isTrainee &&
    !!session?.is_instant &&
    remainingSeconds != null &&
    remainingSeconds <= EXTEND_PROMPT_SECONDS;

  const meetingUrl = `${WEB_ORIGIN}/meeting?id=${lessonId}`;

  const injectedJS = token
    ? `
      try {
        localStorage.setItem('token', ${JSON.stringify(token)});
        ${
          accountType
            ? `localStorage.setItem('acc_type', ${JSON.stringify(accountType)});`
            : `/* skip acc_type override */`
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
        mediaCapturePermissionGrantType={
          Platform.OS === "ios" ? "grant" : undefined
        }
        onError={(e) => {
          console.warn("[Meeting] WebView error", e.nativeEvent);
          reportOpsEvent({
            event_type: "CLIENT_WEBVIEW_ERROR",
            category: "connection",
            severity: "error",
            session_id: lessonId,
            title: "Meeting WebView load error",
            payload: e.nativeEvent as unknown as Record<string, unknown>,
            correlation_id: lessonId,
          });
        }}
      />

      <PortraitCallOverlay
        peer={peer}
        countdownLabel={countdownLabel}
        countdownExpired={countdownExpired || status === "ended"}
        showExtendButton={showExtendButton}
        onExtendPress={() => setExtendModalOpen(true)}
        extensionNotice={extensionNotice}
        onLeavePress={confirmLeave}
        onMinimize={goHome}
      />

      <SessionExtensionModal
        visible={extendModalOpen}
        sessionId={lessonId}
        remainingSeconds={remainingSeconds}
        flow={extensionFlow}
        onDismiss={() => setExtendModalOpen(false)}
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
