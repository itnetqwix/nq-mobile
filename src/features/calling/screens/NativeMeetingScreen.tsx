/**
 * NativeMeetingScreen — RN port of the web `VideoCallUI` orchestrator from
 * `nq-frontend-main/app/components/portrait-calling/index.jsx`.
 *
 * Responsibilities:
 *   1. Look up the session details (cached or fresh) so we can build the
 *      from/to participant pair for the engine.
 *   2. Ensure runtime camera + microphone permissions before mounting the
 *      `CallProvider` — fail fast with a clear screen state otherwise.
 *   3. Compose the call surface:
 *        ┌─────────────────────────────────────┐
 *        │ TimeRemaining                       │   ← top chrome
 *        │                                     │
 *        │ remote video / clip player          │
 *        │                                     │
 *        │           [draggable local mini]    │
 *        │                                     │
 *        │ ActionButtons (mute, cam, end, …)   │   ← bottom chrome
 *        └─────────────────────────────────────┘
 *   4. Open the rating modal on call end (web parity — trainer + trainee both
 *      prompted post-call).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMeetingChromeInsets } from "../useMeetingChromeInsets";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../../navigation/types";
import { AccountType } from "../../../constants/accountType";
import { useAuth } from "../../auth/context/AuthContext";
import { useSocket } from "../../socket/SocketContext";
import { queryKeys } from "../../../lib/queryKeys";
import { fetchMeetingSession, fetchScheduledMeetings } from "../../home/api/homeApi";
import { parseIceServersFromSession } from "../meetingIceServers";
import { getClipPlaybackUrl } from "../../../lib/clipMediaUrl";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import {
  clipIdOf,
  clipsFromSession,
  resolveClipPlayback,
} from "../clipSyncUtils";
import { useDrawingSync } from "../useDrawingSync";
import { useMeetingScreenshot } from "../useMeetingScreenshot";

import { CallProvider, useCall } from "../CallContext";
import {
  registerActiveCall,
  unregisterActiveCall,
} from "../activeCallRegistry";
import { ensureCallPermissions } from "../permissions";
import { useLessonTimer } from "../useLessonTimer";
import { useAudioRoute } from "../useAudioRoute";
import { useClipSync } from "../useClipSync";
import type { CallParticipant, SessionRole } from "../types";
import {
  NOTIFICATION_TITLES,
  NOTIFICATION_TYPES,
  useNotifications,
} from "../../notifications/NotificationContext";

import { UserBox } from "../components/UserBox";
import {
  DraggableVideoPip,
  PIP_HEIGHT,
  PIP_WIDTH,
} from "../components/DraggableVideoPip";
import { useVideoPipLayout } from "../useVideoPipLayout";
import { useMeetingLayout } from "../useMeetingLayout";
import { useNativeMeetingPip } from "../hooks/useNativeMeetingPip";
import { MeetingIosPipHost } from "../components/MeetingIosPipHost";
import { useCallForegroundRecovery } from "../hooks/useCallForegroundRecovery";
import { useCallDegradation } from "../hooks/useCallDegradation";
import { useCallQualityReporter } from "../hooks/useCallQualityReporter";
import { useCallQualitySocketReporter } from "../hooks/useCallQualitySocketReporter";
import { useAdaptiveLessonNetwork } from "../hooks/useAdaptiveLessonNetwork";
import { useLessonNetworkOutagePause } from "../hooks/useLessonNetworkOutagePause";
import { LESSON_NETWORK_TIER_CONFIG } from "../lessonNetworkTier";
import { streamOffHintForTile } from "../meetingStreamLabels";
import { useNetworkOnline } from "../../../lib/networkStatusStore";
import { useInCallPermissions } from "../hooks/useInCallPermissions";
import { ReconnectFailedOverlay } from "../components/ReconnectFailedOverlay";
import {
  hasShownSessionRating,
  markSessionRatingShown,
  stashPendingSessionRating,
} from "../postSessionRatingStore";
import { MeetingLiveStage } from "../components/MeetingLiveStage";
import { MeetingPaymentSummaryChip } from "../components/MeetingPaymentSummaryChip";
import { ClipMiniPip } from "../components/ClipMiniPip";
import { ActionButtons } from "../components/ActionButtons";
import { TimeRemaining } from "../components/TimeRemaining";
import { MeetingPeerJoinedToast } from "../components/MeetingPeerJoinedToast";
import { MeetingCoachChip } from "../components/MeetingCoachChip";
import { resolveMeetingStatusBanner } from "../meetingUx";
import { ConnectionQualityPill } from "../components/ConnectionQualityPill";
import { NetworkLessonBanner } from "../components/NetworkLessonBanner";
import {
  MeetingTrainerOverflowMenu,
  type TrainerOverflowAction,
} from "../components/MeetingTrainerOverflowMenu";
import {
  ScreenshotCapturePickerModal,
  type ScreenshotCaptureChoice,
} from "../components/ScreenshotCapturePickerModal";
import { ClipPickerModal } from "../components/ClipPickerModal";
import { LockedDualClipStage } from "../components/LockedDualClipStage";
import { UnlockedDualClipStage } from "../components/UnlockedDualClipStage";
import { ClipPlayer, type ZoomPanEmitMode } from "../components/ClipPlayer";
import { ClipZoomControls } from "../components/ClipZoomControls";
import { ClipPlaybackControls } from "../components/ClipPlaybackControls";
import { DrawingOverlay } from "../components/DrawingOverlay";
import {
  MeetingAnnotationToolbar,
  type AnnotationTool,
} from "../components/MeetingAnnotationToolbar";
import { SessionGamePlanModal } from "../components/SessionGamePlanModal";
import { SessionScreenshotSheet } from "../components/SessionScreenshotSheet";
import { SessionScreenshotDetailsModal } from "../components/SessionScreenshotDetailsModal";
import { ScreenshotCompositeHost } from "../components/ScreenshotCompositeHost";
import type { ScreenshotCaptureSource } from "../useMeetingScreenshot";
import { RecordingBar } from "../components/RecordingBar";
import { useInstantLessonRecording } from "../useInstantLessonRecording";
import { persistTraineeClipsOnBooking } from "../traineeMidLessonClips";
import type { ClipRow } from "../../instant-lesson/instantLessonClipsApi";
import { RatingsModal } from "../components/RatingsModal";
import { MeetingJoinBanner } from "../components/MeetingJoinBanner";
import { SessionRecapSheet } from "../components/SessionRecapSheet";
import { MeetingAgendaBanner } from "../components/MeetingAgendaBanner";
import { MeetingLiveNotesPanel } from "../components/MeetingLiveNotesPanel";
import { MeetingTraineeNotesPanel } from "../components/MeetingTraineeNotesPanel";
import { CallSlotTakenOverModal } from "../components/CallSlotTakenOverModal";
import {
  navigateToBookTrainer,
  navigateToMyLocker,
} from "../../../navigation/navigationRef";
import { SessionHandoffScreen } from "../components/SessionHandoffScreen";
import { GamePlanStatusPill } from "../components/GamePlanStatusPill";
import { useLessonLiveState } from "../hooks/useLessonLiveState";
import {
  fetchSessionHandoffSummary,
  fetchSessionJoinReadiness,
  type SessionHandoffSummary,
} from "../sessionLiveApi";
import { DualLiveStage } from "../components/DualLiveStage";
import { useSessionPresence } from "../useSessionPresence";
import { meetingTheme } from "../meetingTheme";
import { useSessionExtensionFlow } from "../useSessionExtensionFlow";
import { SessionExtensionModal } from "../components/SessionExtensionModal";
import { TrainerExtensionRequestModal } from "../components/TrainerExtensionRequestModal";
import {
  SessionTimeWarningModal,
  type SessionWarningKind,
} from "../components/SessionTimeWarningModal";

type Props = NativeStackScreenProps<RootStackParamList, "Meeting">;

type SessionRow = Record<string, any>;

const NAVY = meetingTheme.navy;

/** Look up the booking record across the React Query caches we already
 *  populate in UpcomingSessionsScreen / HomeScreen. Falls back to a fresh
 *  upcoming+confirmed pull when the user landed here cold. */
function useSessionLookup(lessonId: string) {
  const queryClient = useQueryClient();
  const cached = useMemo<SessionRow | null>(() => {
    const caches = queryClient.getQueriesData<SessionRow[]>({
      queryKey: queryKeys.sessions.all,
    });
    for (const [, list] of caches) {
      if (!Array.isArray(list)) continue;
      const hit = list.find((s) => String(s?._id) === String(lessonId));
      if (hit) return hit;
    }
    return null;
  }, [queryClient, lessonId]);

  /** Always fetch the booking row with populated `trainee_clips` — list cache often
   *  only has id arrays and previously blocked preload after a failed first pass. */
  const { data: fetched, isLoading } = useQuery<SessionRow | null>({
    queryKey: queryKeys.sessions.lookup(lessonId),
    enabled: !!lessonId,
    queryFn: async () => {
      const direct = await fetchMeetingSession(lessonId);
      if (direct) return direct;
      const [upcoming, confirmed] = await Promise.all([
        fetchScheduledMeetings("upcoming").catch(() => []),
        fetchScheduledMeetings("confirmed").catch(() => []),
      ]);
      return (
        [...upcoming, ...confirmed].find(
          (s) => String(s?._id) === String(lessonId)
        ) ?? null
      );
    },
    staleTime: 30_000,
  });

  const session = useMemo<SessionRow | null>(() => {
    if (!cached && !fetched) return null;
    const merged: SessionRow = { ...(cached ?? {}), ...(fetched ?? {}) };
    const populated = fetched?.trainee_clips ?? cached?.trainee_clips;
    if (Array.isArray(populated) && populated.length > 0) {
      merged.trainee_clips = populated;
    }
    return merged;
  }, [cached, fetched]);

  return { session, isLoading: isLoading && !session };
}

export function NativeMeetingScreen({ navigation, route }: Props) {
  const { lessonId, joinAudioOnly: joinAudioOnlyParam } = route.params;
  const startWithCameraOff = Boolean(joinAudioOnlyParam);
  const { accountType, user } = useAuth();
  const { session, isLoading } = useSessionLookup(lessonId);
  const { pushLocalToast } = useNotifications();
  const [permState, setPermState] = useState<
    "checking" | "granted" | "denied"
  >("checking");
  const [slotTakenOverOpen, setSlotTakenOverOpen] = useState(false);

  const requestPermissions = useCallback(async () => {
    setPermState("checking");
    const result = await ensureCallPermissions();
    setPermState(result.allGranted ? "granted" : "denied");
  }, []);

  useEffect(() => {
    void requestPermissions();
  }, [requestPermissions]);

  /** When the trainer ends the call we want the PDF game-plan / ratings modal
   *  to render BEFORE navigating away. `postCallActiveRef` is flipped by
   *  `MeetingSurface` when it opens the post-call flow so the CallContext's
   *  `onEnded` (engine teardown) doesn't yank us back to Home prematurely. */
  const postCallActiveRef = useRef(false);
  const peerNameRef = useRef<string | undefined>(undefined);
  const goHome = useCallback(() => {
    postCallActiveRef.current = false;
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  }, [navigation]);
  const handleCallEnded = useCallback(() => {
    if (postCallActiveRef.current) {
      goHome();
      return;
    }
    /**
     * Engine torn down without the post-call flow ever opening → almost
     * always a drop (ICE failure, app killed mid-call, peer crashed). We
     * stash a rejoin record so the dashboard banner can offer one-tap
     * re-entry. `setLastInterruptedSession` debounces stale records on
     * its own.
     */
    try {
      const { setLastInterruptedSession } = require("../callRejoinStore");
      setLastInterruptedSession({
        lessonId: String(lessonId),
        partnerName: peerNameRef.current,
        endedReason: "drop",
        endedAt: Date.now(),
      });
    } catch {
      /* noop */
    }
    goHome();
  }, [goHome, lessonId]);
  const beginPostCallFlow = useCallback(() => {
    postCallActiveRef.current = true;
  }, []);

  const role: SessionRole =
    accountType === AccountType.TRAINER ? "Trainer" : "Trainee";

  const me: CallParticipant | null = useMemo(() => {
    if (!user) return null;
    const u = user as Record<string, any>;
    return {
      _id: String(u._id ?? u.id ?? ""),
      fullname: u.fullname ?? u.fullName,
      fullName: u.fullName ?? u.fullname,
      profile_picture: getS3ImageUrl(u.profile_picture) || undefined,
    };
  }, [user]);

  const peer: CallParticipant | null = useMemo(() => {
    if (!session) return null;
    const other =
      role === "Trainer" ? session.trainee_info : session.trainer_info;
    if (!other?._id) return null;
    return {
      _id: String(other._id),
      fullname: other.fullname,
      fullName: other.fullName,
      profile_picture: getS3ImageUrl(other.profile_picture) || undefined,
    };
  }, [session, role]);

  const iceServers = useMemo(
    () => parseIceServersFromSession(session),
    [session]
  );

  useEffect(() => {
    peerNameRef.current = peer?.fullname ?? peer?.fullName ?? undefined;
  }, [peer]);

  if (isLoading || permState === "checking" || !me) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={NAVY} />
        <Text style={styles.centerText}>Connecting to your session…</Text>
      </View>
    );
  }

  if (permState === "denied") {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>Camera and microphone required</Text>
        <Text style={styles.centerText}>
          NetQwix needs camera and microphone access to start your lesson. Enable both in
          Settings, then return here.
        </Text>
        <Pressable style={styles.permBtn} onPress={() => void Linking.openSettings()}>
          <Text style={styles.permBtnText}>Open Settings</Text>
        </Pressable>
        <Pressable style={[styles.permBtn, styles.permBtnSecondary]} onPress={requestPermissions}>
          <Text style={[styles.permBtnText, styles.permBtnTextSecondary]}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!peer) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>Session unavailable</Text>
        <Text style={styles.centerText}>
          We can't find this lesson. It may have ended or been removed from your schedule.
        </Text>
        <Pressable style={styles.permBtn} onPress={goHome}>
          <Text style={styles.permBtnText}>Go to home</Text>
        </Pressable>
      </View>
    );
  }

  const peerDisplayName =
    peer?.fullname ?? peer?.fullName ?? "Your partner";

  return (
    <>
    <CallProvider
      sessionId={lessonId}
      fromUser={me}
      toUser={peer}
      role={role}
      iceServers={iceServers}
      startWithCameraOff={startWithCameraOff}
      onEnded={handleCallEnded}
      onPeerJoined={() => {
        pushLocalToast({
          title: NOTIFICATION_TITLES.peerJoinedCall,
          description: `${peerDisplayName} joined the meeting.`,
          type: NOTIFICATION_TYPES.DEFAULT,
        });
      }}
      onPeerDisconnected={() => {
        pushLocalToast({
          title: NOTIFICATION_TITLES.peerLeftCall,
          description: `${peerDisplayName} disconnected. Waiting for them to rejoin…`,
          type: NOTIFICATION_TYPES.TRANSCATIONAL,
        });
      }}
      onPeerLeft={() => {
        pushLocalToast({
          title: NOTIFICATION_TITLES.peerLeftCall,
          description: `${peerDisplayName} ended the lesson.`,
          type: NOTIFICATION_TYPES.TRANSCATIONAL,
          persistInInbox: true,
        });
      }}
      onSlotTakenOver={() => {
        setSlotTakenOverOpen(true);
      }}
    >
      <MeetingSurface
        lessonId={lessonId}
        session={session}
        isTrainer={role === "Trainer"}
        accountType={accountType}
        onExit={goHome}
        onRejoinLesson={() => {
          navigation.replace("Meeting", {
            lessonId: String(lessonId),
            skipLobby: true,
          });
        }}
        onPostCallFlowStart={beginPostCallFlow}
        myId={me._id}
        peerId={peer._id}
        peerDisplayName={peerDisplayName}
      />
    </CallProvider>
    <CallSlotTakenOverModal
      visible={slotTakenOverOpen}
      onExit={goHome}
    />
    </>
  );
}

function MeetingSurface({
  lessonId,
  session,
  isTrainer,
  accountType,
  onExit,
  onRejoinLesson,
  onPostCallFlowStart,
  myId,
  peerId,
  peerDisplayName,
}: {
  lessonId: string;
  session: SessionRow | null;
  isTrainer: boolean;
  accountType: string | null;
  onExit: () => void;
  onRejoinLesson: () => void;
  onPostCallFlowStart: () => void;
  myId: string;
  peerId: string;
  peerDisplayName: string;
}) {
  const { user: authUser } = useAuth();
  const audioRoute = useAudioRoute();
  const sessionBookingClips = useMemo(
    () =>
      clipsFromSession(session).filter(
        (c) => Boolean(resolveClipPlayback(c).url || getClipPlaybackUrl(c))
      ),
    [session]
  );
  const [activeClipUri, setActiveClipUri] = useState<string | null>(null);
  const { width: winW, height: winH } = useWindowDimensions();
  const [localPipSize, setLocalPipSize] = useState({ w: PIP_WIDTH, h: PIP_HEIGHT });
  const [remotePipSize, setRemotePipSize] = useState({ w: PIP_WIDTH, h: PIP_HEIGHT });
  const {
    localStream,
    remoteStream,
    bothJoined,
    peerJoined,
    partnerDisconnected,
    cameraEnabled,
    remoteCameraOff,
    localCameraOffReason,
    remoteCameraOffReason,
    userCameraOffIntent,
    setCameraPausedForNetwork,
    setNetworkAdaptation,
    markPartnerCameraNetworkPaused,
    toggleCamera,
    status,
    endCall,
    recoverConnection,
    getNetworkStats,
    lastError,
    clearLastError,
    joinDeniedCanTakeOver,
    requestCallTakeover,
  } = useCall();

  useEffect(() => {
    registerActiveCall({ sessionId: lessonId, onForceEnd: endCall });
    return () => unregisterActiveCall(lessonId);
  }, [lessonId, endCall]);

  const { socket, reconnectFailed } = useSocket();

  const presence = useSessionPresence({
    socket,
    sessionId: lessonId,
    peerId,
    isTrainer,
    peerDisplayName,
    mediaPartnerJoined: bothJoined || !!peerJoined,
    lessonActive: (bothJoined || !!peerJoined) && !partnerDisconnected,
  });

  /** Socket presence when synced; otherwise fall back to WebRTC join signals. */
  const partnerInSession =
    presence.trainerConnected != null && presence.traineeConnected != null
      ? presence.partnerConnected
      : (bothJoined || !!peerJoined) && !partnerDisconnected;
  const { pushLocalToast } = useNotifications();
  const openAudioOutputPicker = useCallback(() => {
    const options: Array<{ text: string; onPress?: () => void; style?: "cancel" }> = [
      {
        text: `Speaker${audioRoute.route === "speaker" ? " (current)" : ""}`,
        onPress: () => audioRoute.setAudioRoute("speaker"),
      },
      {
        text: `Earpiece${audioRoute.route === "earpiece" ? " (current)" : ""}`,
        onPress: () => audioRoute.setAudioRoute("earpiece"),
      },
    ];
    if (audioRoute.hasBluetooth) {
      options.push({
        text: `Bluetooth${audioRoute.route === "bluetooth" ? " (current)" : ""}`,
        onPress: () => audioRoute.setAudioRoute("bluetooth"),
      });
    }
    options.push({
      text: "Auto",
      onPress: () => audioRoute.setAudioRoute("auto"),
    });
    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Audio output", "Choose where call audio plays.", options);
  }, [audioRoute]);

  /** Small client-side buffer (5 s) before the trainer auto-starts the timer —
   *  same as the web. Lets both sides settle their connection. */
  const [timerBufferElapsed, setTimerBufferElapsed] = useState(false);
  useEffect(() => {
    if (!partnerInSession) return;
    const id = setTimeout(() => setTimerBufferElapsed(true), 5000);
    return () => clearTimeout(id);
  }, [partnerInSession]);

  const bothUsersForTimer =
    presence.trainerConnected != null && presence.traineeConnected != null
      ? presence.trainerConnected && presence.traineeConnected
      : !!bothJoined;

  const lessonTimer = useLessonTimer({
    socket,
    sessionId: lessonId,
    bothUsersJoined: bothUsersForTimer,
    timerBufferElapsed,
    accountType,
    session,
  });

  const lessonLive = useLessonLiveState(lessonId, isTrainer);

  const { data: joinReadiness } = useQuery({
    queryKey: ["session", "join-readiness", lessonId],
    queryFn: () => fetchSessionJoinReadiness(lessonId),
    staleTime: 60_000,
  });

  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffSummary, setHandoffSummary] = useState<SessionHandoffSummary | null>(null);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [recapSheetOpen, setRecapSheetOpen] = useState(false);
  const postCallFlowStartedRef = useRef(false);

  const openHandoff = useCallback(async () => {
    setHandoffLoading(true);
    setHandoffOpen(true);
    try {
      const summary = await fetchSessionHandoffSummary(lessonId);
      setHandoffSummary(summary);
    } catch {
      setHandoffSummary(null);
    } finally {
      setHandoffLoading(false);
    }
  }, [lessonId]);

  const elapsedLessonSeconds = useMemo(() => {
    const dur = lessonTimer.authoritativeTimer?.duration;
    const rem = lessonTimer.remainingSeconds;
    if (dur != null && rem != null) return Math.max(0, dur - rem);
    return 0;
  }, [lessonTimer.authoritativeTimer?.duration, lessonTimer.remainingSeconds]);

  const inCallPerms = useInCallPermissions(
    partnerInSession || bothJoined || !!peerJoined
  );

  /** Two-party paid extension flow. Single hook drives both the trainee
   *  picker/payment modal and the trainer accept/reject modal — the relevant
   *  modal opens itself based on `flow.state.phase`. */
  const extensionFlow = useSessionExtensionFlow({
    socket,
    sessionId: lessonId,
    isTrainer,
    myUserId: String(myId),
    pendingFromSync: lessonTimer.pendingExtensionRequest,
  });

  /** Trainee-side modal visibility. Auto-opened by warning modal "Extend" CTA
   *  or whenever the server flips us into an active extension phase. */
  const [traineeExtendOpen, setTraineeExtendOpen] = useState(false);
  useEffect(() => {
    if (isTrainer) return;
    if (
      extensionFlow.state.phase === "awaiting_trainer" ||
      extensionFlow.state.phase === "awaiting_payment" ||
      extensionFlow.state.phase === "paying"
    ) {
      setTraineeExtendOpen(true);
    } else if (
      extensionFlow.state.phase === "applied" ||
      extensionFlow.state.phase === "rejected" ||
      extensionFlow.state.phase === "expired" ||
      extensionFlow.state.phase === "cancelled"
    ) {
      // Let the modal show its terminal message briefly before auto-closing.
      const id = setTimeout(() => setTraineeExtendOpen(false), 2500);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [isTrainer, extensionFlow.state.phase]);

  /** 5/2-minute warning modals. We keep them lightweight so the rest of the
   *  meeting UI stays unobstructed. */
  const [activeWarning, setActiveWarning] = useState<SessionWarningKind | null>(
    null
  );
  const seenWarningsRef = useRef<Set<SessionWarningKind>>(new Set());

  /** Extension + time-warning modals must not stack (only one blocking sheet). */
  const extensionUiBlocking = useMemo(() => {
    const phase = extensionFlow.state.phase;
    return (
      traineeExtendOpen ||
      phase === "awaiting_trainer" ||
      phase === "awaiting_payment" ||
      phase === "paying"
    );
  }, [traineeExtendOpen, extensionFlow.state.phase]);

  useEffect(() => {
    if (extensionUiBlocking) {
      setActiveWarning(null);
    }
  }, [extensionUiBlocking]);

  const timeWarningVisible = activeWarning != null && !extensionUiBlocking;

  const networkOnline = useNetworkOnline();

  const timerStatusHint = useMemo(() => {
    if (
      lessonTimer.status === "paused" &&
      (lessonTimer.pauseReason === "extension_pending" ||
        lessonTimer.pauseReason === "extension_accepted")
    ) {
      return "Paused — extension in progress";
    }
    if (presence.partnerLeftKind === "trainer" && lessonTimer.status === "paused") {
      return "Paused — coach disconnected";
    }
    if (
      presence.partnerLeftKind === "trainee" &&
      lessonTimer.status === "running"
    ) {
      return "Trainee disconnected — timer running";
    }
    if (presence.partnerReconnecting) {
      return "Partner reconnecting…";
    }
    if (lessonTimer.status === "paused" && lessonTimer.pauseReason === "network_outage") {
      return "Paused — connection outage";
    }
    if (!networkOnline && lessonTimer.status === "running") {
      return "Weak connection — lesson continues";
    }
    return null;
  }, [
    presence.partnerLeftKind,
    presence.partnerReconnecting,
    lessonTimer.status,
    lessonTimer.pauseReason,
    networkOnline,
  ]);

  const networkAdaptive = useAdaptiveLessonNetwork({
    enabled: partnerInSession && bothJoined,
    online: networkOnline,
    cameraEnabled,
    userCameraOffIntent,
    setCameraPausedForNetwork,
    getNetworkStats,
    onTierChange: setNetworkAdaptation,
  });

  const networkTierConfig =
    LESSON_NETWORK_TIER_CONFIG[networkAdaptive.mode];

  const queryClient = useQueryClient();

  const clipSync = useClipSync({
    socket,
    fromUserId: myId,
    toUserId: peerId,
    sessionId: lessonId,
    isTrainer,
    networkTier: networkAdaptive.mode,
    onPeerClipsShared: isTrainer
      ? () => {
          pushLocalToast({
            title: "Trainee shared clips",
            description: "Review the clips your trainee sent during the lesson.",
            type: NOTIFICATION_TYPES.TRANSCATIONAL,
          });
        }
      : undefined,
  });

  const clipPaneUrisEarly = useMemo(
    () =>
      clipSync.selectedClips
        .slice(0, 2)
        .map((c) => resolveClipPlayback(c).url)
        .filter((u): u is string => !!u),
    [clipSync.selectedClips]
  );
  const hasClipStage =
    clipPaneUrisEarly.length > 0 &&
    (clipSync.selectedClips.length > 0 || Boolean(clipSync.activeClipId));
  const chrome = useMeetingChromeInsets({ inClipMode: hasClipStage });

  const meetingLayout = useMeetingLayout({
    socket,
    sessionId: lessonId,
    myId,
    peerId,
    isTrainer,
  });

  useNativeMeetingPip({
    enabled: partnerInSession && !!remoteStream,
    preferRemote: true,
  });

  useCallForegroundRecovery({
    enabled: partnerInSession,
    socket,
    status,
    partnerDisconnected,
    recoverConnection,
    sessionId: lessonId,
  });

  useCallDegradation({
    enabled: partnerInSession,
    sessionId: lessonId,
    getNetworkStats,
    recoverConnection,
  });

  useCallQualityReporter({
    enabled: partnerInSession && bothJoined,
    sessionId: lessonId,
    getNetworkStats,
  });

  const partnerQualityLabel = useMemo(() => {
    const q = isTrainer
      ? lessonLive.liveState.quality.trainee
      : lessonLive.liveState.quality.trainer;
    return q?.label ?? null;
  }, [isTrainer, lessonLive.liveState.quality]);

  useLessonNetworkOutagePause({
    enabled: partnerInSession && isTrainer,
    isTrainer,
    socket,
    sessionId: lessonId,
    networkOnline,
    partnerDisconnected,
    timerStatus: lessonTimer.status,
  });

  const partnerWeak =
    (partnerQualityLabel ?? "").toLowerCase().includes("weak") ||
    (partnerQualityLabel ?? "").toLowerCase().includes("poor");

  useEffect(() => {
    markPartnerCameraNetworkPaused(partnerWeak);
  }, [markPartnerCameraNetworkPaused, partnerWeak, remoteCameraOff]);

  useCallQualitySocketReporter({
    enabled: partnerInSession && bothJoined,
    socket,
    sessionId: lessonId,
    role: isTrainer ? "trainer" : "trainee",
    getNetworkStats,
  });

  const [meetingBounds, setMeetingBounds] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const pipLayout = useVideoPipLayout({
    isTrainer,
    hiddenVideos: clipSync.hiddenVideos,
    setVideoHidden: clipSync.setVideoHidden,
    bounds: meetingBounds,
    safeTop: chrome.insets.top,
    safeBottom: chrome.insets.bottom,
    pipReservedBottom: chrome.pipSafeBottom,
  });

  const { applyRemoteTiles } = pipLayout;
  const pipPositionPatch = useCallback(
    (pos: { x: number; y: number }, size?: { w: number; h: number }) => {
      if (!meetingBounds) {
        return { x: pos.x, y: pos.y, ...(size ?? {}) };
      }
      const { width, height } = meetingBounds;
      return {
        x: pos.x,
        y: pos.y,
        nx: pos.x / width,
        ny: pos.y / height,
        ...(size?.w && size?.h
          ? {
              w: size.w,
              h: size.h,
              nw: size.w / width,
              nh: size.h / height,
            }
          : {}),
      };
    },
    [meetingBounds]
  );

  useEffect(() => {
    if (isTrainer) return;
    applyRemoteTiles(meetingLayout.tiles);
    const trainerLocal = meetingLayout.tiles.local;
    const trainerRemote = meetingLayout.tiles.remote;
    const remoteW =
      trainerLocal.nw != null && meetingBounds
        ? trainerLocal.nw * meetingBounds.width
        : trainerLocal.w;
    const remoteH =
      trainerLocal.nh != null && meetingBounds
        ? trainerLocal.nh * meetingBounds.height
        : trainerLocal.h;
    const localW =
      trainerRemote.nw != null && meetingBounds
        ? trainerRemote.nw * meetingBounds.width
        : trainerRemote.w;
    const localH =
      trainerRemote.nh != null && meetingBounds
        ? trainerRemote.nh * meetingBounds.height
        : trainerRemote.h;
    if (remoteW > 0 && remoteH > 0) setRemotePipSize({ w: remoteW, h: remoteH });
    if (localW > 0 && localH > 0) setLocalPipSize({ w: localW, h: localH });
  }, [isTrainer, meetingLayout.tiles, applyRemoteTiles, meetingBounds]);

  const drawingSync = useDrawingSync({
    socket,
    userInfo: { from_user: myId, to_user: peerId },
    sessionId: lessonId,
    isTrainer,
    drawingEmitMinMs: networkTierConfig.drawingEmitMinMs,
  });

  useEffect(() => {
    if (!socket) return;

    const replayTrainerState = () => {
      if (!isTrainer) return;
      clipSync.replayClipSocketState();
      meetingLayout.replayLayoutState();
      drawingSync.replaySocketState();
    };

    const requestMediaReplay = () => {
      if (isTrainer) return;
      socket.emit("LESSON_MEDIA_REPLAY_REQUEST", { sessionId: lessonId });
    };

    const handleMediaReplayRequest = (payload: { sessionId?: string }) => {
      if (!isTrainer) return;
      if (String(payload?.sessionId) !== String(lessonId)) return;
      replayTrainerState();
    };

    socket.on("connect", replayTrainerState);
    socket.on("reconnect", replayTrainerState);
    socket.on("connect", requestMediaReplay);
    socket.on("reconnect", requestMediaReplay);
    socket.on("LESSON_MEDIA_REPLAY_REQUEST", handleMediaReplayRequest);
    return () => {
      socket.off("connect", replayTrainerState);
      socket.off("reconnect", replayTrainerState);
      socket.off("connect", requestMediaReplay);
      socket.off("reconnect", requestMediaReplay);
      socket.off("LESSON_MEDIA_REPLAY_REQUEST", handleMediaReplayRequest);
    };
  }, [
    socket,
    isTrainer,
    lessonId,
    clipSync.replayClipSocketState,
    meetingLayout.replayLayoutState,
    drawingSync.replaySocketState,
  ]);

  const screenshot = useMeetingScreenshot({
    sessionId: lessonId,
    trainerId: isTrainer ? myId : peerId,
    traineeId: isTrainer ? peerId : myId,
    isTrainer,
    onCaptured: ({ localUri, imageKey }) => {
      setPendingScreenshotPreviewUri(localUri);
      setPendingScreenshotKey(imageKey);
      setScreenshotDetailsOpen(true);
      pushLocalToast({
        title: "Screenshot captured",
        description: "Add a description to save it to the game plan.",
        type: NOTIFICATION_TYPES.DEFAULT,
      });
    },
  });

  const peerUser = session
    ? isTrainer
      ? session.trainee_info
      : session.trainer_info
    : null;

  const isInstant = !!session?.is_instant;

  const instantRecording = useInstantLessonRecording({
    socket,
    sessionId: lessonId,
    myId,
    peerId,
    traineeId: isTrainer ? peerId : myId,
    isTrainer,
    isInstantLesson: isInstant,
    lessonTimerStatus: lessonTimer.status,
    captureStageFrame: screenshot.captureStageFrame,
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [traineeDroveClips, setTraineeDroveClips] = useState(false);
  const [ratingsOpen, setRatingsOpen] = useState(false);
  const [gamePlanOpen, setGamePlanOpen] = useState(false);
  const [gamePlanBanner, setGamePlanBanner] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);
  const [screenshotSheetOpen, setScreenshotSheetOpen] = useState(false);
  const [screenshotDetailsOpen, setScreenshotDetailsOpen] = useState(false);
  const [screenshotPickerOpen, setScreenshotPickerOpen] = useState(false);
  const [pendingScreenshotKey, setPendingScreenshotKey] = useState<string | null>(null);
  const [pendingScreenshotPreviewUri, setPendingScreenshotPreviewUri] = useState<
    string | null
  >(null);
  const [clipDurations, setClipDurations] = useState<[number, number]>([0, 0]);
  const [clipProgresses, setClipProgresses] = useState<[number, number]>([0, 0]);
  const [drawingOverlayKey, setDrawingOverlayKey] = useState(0);
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>("freehand");
  const [annotationColor, setAnnotationColor] = useState("#ff3b30");
  const [annotationArmed, setAnnotationArmed] = useState(false);
  const [annotationToolbarOpen, setAnnotationToolbarOpen] = useState(false);
  const [networkBannerDismissed, setNetworkBannerDismissed] = useState(false);
  const [agendaBannerDismissed, setAgendaBannerDismissed] = useState(false);
  const [statusBannerDismissed, setStatusBannerDismissed] = useState(false);
  const [errorBannerDismissed, setErrorBannerDismissed] = useState(false);
  const clipProgressRefs = useRef<[number, number]>([0, 0]);
  const clipEndedRef = useRef<[boolean, boolean]>([false, false]);
  const lessonStartedNotifiedRef = useRef(false);

  useEffect(() => {
    setNetworkBannerDismissed(false);
  }, [networkAdaptive.mode, networkAdaptive.videoPausedForNetwork]);

  useEffect(() => {
    setAgendaBannerDismissed(false);
  }, [lessonLive.liveState.focusedClipTitle]);

  useEffect(() => {
    setErrorBannerDismissed(false);
  }, [lastError]);

  useEffect(() => {
    if (!session) return;
    const bookingClips = clipsFromSession(session);
    if (bookingClips.length > 0) {
      clipSync.preloadBookingClips(bookingClips);
    }
  }, [session, session?.trainee_clips, clipSync]);

  useEffect(() => {
    if (!bothUsersForTimer) {
      lessonStartedNotifiedRef.current = false;
      return;
    }
    if (lessonStartedNotifiedRef.current) return;
    lessonStartedNotifiedRef.current = true;
    pushLocalToast({
      title: NOTIFICATION_TITLES.sessionStarted,
      description: "Lesson started — you're both in the call.",
      type: NOTIFICATION_TYPES.TRANSCATIONAL,
    });
  }, [bothUsersForTimer, pushLocalToast]);

  /** When the trainer selects a clip we receive the clip metadata so we can
   *  compute the playback URL locally. The trainee receives only the id via
   *  socket and looks up the clip object through the same `getClipPlaybackUrl`
   *  helper used elsewhere. */
  const handleClipsPicked = useCallback(
    (clips: any[]) => {
      if (clips.length === 0) {
        setActiveClipUri(null);
        clipSync.emitSelectClips([]);
        meetingLayout.clearFocus();
        return;
      }
      const playable = clips.filter((c) => getClipPlaybackUrl(c));
      if (playable.length === 0) {
        Alert.alert("Clip unavailable", "Could not resolve playback URLs for the selected clips.");
        return;
      }
      const primary = playable[0];
      const uri = getClipPlaybackUrl(primary);
      if (uri) setActiveClipUri(uri);
      setTraineeDroveClips(false);
      clipSync.emitSelectClips(playable);
    },
    [clipSync, meetingLayout]
  );

  const handleTraineeClipsPicked = useCallback(
    async (clips: ClipRow[]) => {
      if (isTrainer) return;
      if (clips.length === 0) {
        handleClipsPicked([]);
        return;
      }
      const playable = clips.filter((c) => getClipPlaybackUrl(c));
      if (playable.length === 0) {
        Alert.alert(
          "Clip unavailable",
          "Could not resolve playback URLs for the selected clips."
        );
        return;
      }
      try {
        await persistTraineeClipsOnBooking(lessonId, session, clips);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.sessions.lookup(lessonId),
        });
        const primary = playable[0];
        const uri = getClipPlaybackUrl(primary);
        if (uri) setActiveClipUri(uri);
        setTraineeDroveClips(true);
        clipSync.broadcastClipsMidLesson(playable);
        pushLocalToast({
          title: "Clips shared",
          description: "Your coach can now review these clips in the lesson.",
          type: NOTIFICATION_TYPES.TRANSCATIONAL,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Could not share clips.";
        Alert.alert("Share clips", msg);
      }
    },
    [
      clipSync,
      handleClipsPicked,
      isTrainer,
      lessonId,
      pushLocalToast,
      queryClient,
      session,
    ]
  );

  useEffect(() => {
    if (clipSync.activeClipUrl) {
      setActiveClipUri(clipSync.activeClipUrl);
    } else if (!clipSync.activeClipId) {
      setActiveClipUri(null);
      setClipDurations([0, 0]);
      setClipProgresses([0, 0]);
    }
  }, [clipSync.activeClipId, clipSync.activeClipUrl]);

  useEffect(() => {
    if (!isTrainer || !clipSync.activeClipId) return;
    const clip = clipSync.selectedClips.find(
      (c) => clipIdOf(c) === clipSync.activeClipId
    );
    const title = String(clip?.title ?? clip?.name ?? "Clip");
    lessonLive.setFocusedClip(String(clipSync.activeClipId), title);
  }, [isTrainer, clipSync.activeClipId, clipSync.selectedClips, lessonLive.setFocusedClip]);

  const clipPaneUris = clipPaneUrisEarly;

  useEffect(() => {
    if (!clipSync.lockMode || clipSync.selectedClips.length < 2) return;
    const point = clipSync.lockPoint;
    if (!Number.isFinite(point)) return;
    clipProgressRefs.current = [point, point];
    setClipProgresses([point, point]);
  }, [clipSync.lockMode, clipSync.lockPoint, clipSync.selectedClips.length]);

  useEffect(() => {
    if (!clipSync.seekHint || isTrainer) return;
    const { progress, videoId } = clipSync.seekHint;
    if (!Number.isFinite(progress)) return;
    if (clipSync.lockMode && clipSync.selectedClips.length >= 2) {
      clipProgressRefs.current = [progress, progress];
      setClipProgresses([progress, progress]);
      return;
    }
    if (!videoId) return;
    const paneIndex = clipSync.selectedClips.findIndex(
      (c) => clipIdOf(c) === String(videoId)
    );
    if (paneIndex !== 0 && paneIndex !== 1) return;
    clipProgressRefs.current[paneIndex] = progress;
    setClipProgresses((prev) => {
      const next: [number, number] = [...prev];
      next[paneIndex] = progress;
      return next;
    });
  }, [clipSync.seekHint, clipSync.lockMode, clipSync.selectedClips, isTrainer]);

  const dualClip = clipPaneUris.length >= 2;

  const buildScreenshotSources = useCallback((): ScreenshotCaptureSource[] => {
    if (clipPaneUris.length === 0 && activeClipUri) {
      return [{ uri: activeClipUri, progressSeconds: clipProgresses[0] ?? 0 }];
    }
    return clipSync.selectedClips.slice(0, 2).flatMap((clip, i) => {
      const { url } = resolveClipPlayback(clip);
      if (!url) return [];
      return [{ uri: url, progressSeconds: clipProgresses[i as 0 | 1] ?? 0 }];
    });
  }, [activeClipUri, clipPaneUris.length, clipProgresses, clipSync.selectedClips]);

  const resolveScreenshotSources = useCallback(
    (choice: ScreenshotCaptureChoice): ScreenshotCaptureSource[] | undefined => {
      if (choice === "stage") return undefined;
      const all = buildScreenshotSources();
      if (choice === "bothClips") return all.length >= 2 ? all : all.slice(0, 1);
      if (choice === "clip1") return all.slice(1, 2);
      if (choice === "clip0") return all.slice(0, 1);
      return all.slice(0, 1);
    },
    [buildScreenshotSources]
  );

  const handleScreenshotChoice = useCallback(
    (choice: ScreenshotCaptureChoice) => {
      void screenshot.takeScreenshot(resolveScreenshotSources(choice));
    },
    [resolveScreenshotSources, screenshot]
  );

  const clipScreenshotLabels = useMemo((): [string, string] => {
    const labels = clipSync.selectedClips.slice(0, 2).map((c, i) => {
      const t = String(c?.title ?? c?.name ?? "").trim();
      return t || `Clip ${i + 1}`;
    });
    return [labels[0] ?? "Clip 1", labels[1] ?? "Clip 2"];
  }, [clipSync.selectedClips]);

  const lockedDualClip = dualClip && clipSync.lockMode;
  const clipFocusIndex = lockedDualClip ? null : clipSync.clipFocusIndex;

  const lockedProgress = Math.max(clipProgresses[0], clipProgresses[1]);
  const lockedDuration = Math.max(clipDurations[0], clipDurations[1]);

  const activePaneIndex = useMemo((): 0 | 1 => {
    const idx = clipSync.selectedClips.findIndex(
      (c) => clipIdOf(c) === clipSync.activeClipId
    );
    return idx === 1 ? 1 : 0;
  }, [clipSync.activeClipId, clipSync.selectedClips]);

  const unlockedTimelineProgress = clipProgresses[activePaneIndex];
  const unlockedTimelineDuration = clipDurations[activePaneIndex];

  const isClipAtEnd = useCallback(
    (paneIndex: 0 | 1) => {
      if (clipEndedRef.current[paneIndex]) return true;
      const duration = clipDurations[paneIndex];
      const progress = clipProgresses[paneIndex];
      return duration > 0.5 && progress >= duration - 0.35;
    },
    [clipDurations, clipProgresses]
  );

  const makeClipPlayerProps = (paneIndex: 0 | 1) => {
    const clip = clipSync.selectedClips[paneIndex];
    const clipId = clip ? clipIdOf(clip) : null;
    const zoomPan = clipId ? clipSync.zoomPanByVideoId[String(clipId)] : undefined;
    const seekForPane =
      clipSync.seekHint &&
      (!clipSync.seekHint.videoId ||
        clipSync.seekHint.videoId === clipId ||
        clipSync.lockMode)
        ? Math.floor(clipSync.seekHint.progress * 1000)
        : null;
    const seekNonce = clipSync.seekHint?.receivedAt ?? null;
    return {
      isPlaying: clipSync.isClipPlaying(clipId),
      seekTargetMs: seekForPane,
      seekNonce,
      zoom: zoomPan?.zoom,
      pan: zoomPan?.pan,
      zoomGesturesEnabled: isTrainer && !!clipId,
      onZoomPanChange: clipId
        ? (nextZoom: number, nextPan: { x: number; y: number }, emit?: ZoomPanEmitMode) => {
            clipSync.setZoomPan(String(clipId), nextZoom, nextPan, {
              emitSocket: emit === false ? false : emit ?? "throttle",
            });
          }
        : undefined,
      onZoomPanEnd: clipId
        ? () => clipSync.flushZoomPanEmit(String(clipId))
        : undefined,
      onFrameLayout: clipId
        ? (w: number, h: number) => clipSync.registerClipFrameSize(String(clipId), w, h)
        : undefined,
      showZoomControls: isTrainer && !!clipId,
      onZoomIn: clipId
        ? () => clipSync.bumpZoom(String(clipId), 0.25)
        : undefined,
      onZoomOut: clipId
        ? () => clipSync.bumpZoom(String(clipId), -0.25)
        : undefined,
      onProgressSeconds: (seconds: number) => {
        clipEndedRef.current[paneIndex] = false;
        clipProgressRefs.current[paneIndex] = seconds;
        setClipProgresses((prev) => {
          const next: [number, number] = [...prev];
          next[paneIndex] = seconds;
          return next;
        });
        if (isTrainer && clipId) {
          clipSync.syncPlaybackProgress(clipId, seconds);
        }
      },
      onDurationSeconds: (seconds: number) => {
        setClipDurations((prev) => {
          const next: [number, number] = [...prev];
          next[paneIndex] = seconds;
          return next;
        });
      },
      onEnded: () => {
        clipEndedRef.current[paneIndex] = true;
        clipProgressRefs.current[paneIndex] = clipDurations[paneIndex] || 0;
        setClipProgresses((prev) => {
          const next: [number, number] = [...prev];
          next[paneIndex] = clipDurations[paneIndex] || next[paneIndex];
          return next;
        });
        const id = clip ? clipIdOf(clip) : null;
        if (id && clipSync.isClipPlaying(id)) {
          clipSync.togglePlay(false, id);
        } else if (clipSync.lockMode && clipSync.isPlaying) {
          clipSync.togglePlay(false);
        }
      },
    };
  };

  const handleClipSeek = useCallback(
    (paneIndex: 0 | 1, sec: number) => {
      if (clipSync.lockMode && clipSync.selectedClips.length >= 2) {
        clipEndedRef.current = [false, false];
        clipProgressRefs.current = [sec, sec];
        setClipProgresses([sec, sec]);
        clipSync.seek(sec, { forceEmit: true });
        return;
      }
      clipEndedRef.current[paneIndex] = false;
      clipProgressRefs.current[paneIndex] = sec;
      setClipProgresses((prev) => {
        const next: [number, number] = [...prev];
        next[paneIndex] = sec;
        return next;
      });
      const clip = clipSync.selectedClips[paneIndex];
      const id = clip ? clipIdOf(clip) : null;
      if (id) {
        const { url } = resolveClipPlayback(clip);
        if (url) {
          setActiveClipUri(url);
          clipSync.setActiveClip(id, url);
        }
      }
      clipSync.seek(sec, { forceEmit: true, videoId: id ?? undefined });
    },
    [clipSync]
  );

  const handleClipTogglePlay = useCallback(
    (paneIndex: 0 | 1) => {
      const clip = clipSync.selectedClips[paneIndex];
      const id = clip ? clipIdOf(clip) : null;
      if (!id) return;
      if (clipSync.lockMode) {
        if (!clipSync.isPlaying && (isClipAtEnd(0) || isClipAtEnd(1))) {
          handleClipSeek(0, 0);
        }
        clipSync.togglePlay();
        return;
      }
      const { url } = resolveClipPlayback(clip);
      if (url) {
        setActiveClipUri(url);
        clipSync.setActiveClip(id, url);
      }
      if (!clipSync.isClipPlaying(id) && isClipAtEnd(paneIndex)) {
        handleClipSeek(paneIndex, 0);
      }
      clipSync.togglePlay(undefined, id);
    },
    [clipSync, handleClipSeek, isClipAtEnd]
  );

  const handleLockedClipTogglePlay = useCallback(() => {
    if (!clipSync.isPlaying && (isClipAtEnd(0) || isClipAtEnd(1))) {
      handleClipSeek(0, 0);
    }
    clipSync.togglePlay();
  }, [clipSync, handleClipSeek, isClipAtEnd]);

  const handleSingleClipTogglePlay = useCallback(() => {
    const clip = clipSync.selectedClips[0];
    const id = clip ? clipIdOf(clip) : null;
    if (!id) return;
    if (!clipSync.isClipPlaying(id) && isClipAtEnd(0)) {
      handleClipSeek(0, 0);
    }
    clipSync.togglePlay(undefined, id);
  }, [clipSync, handleClipSeek, isClipAtEnd]);

  const handleToggleLock = useCallback(() => {
    if (clipSync.lockMode) {
      clipSync.toggleLockMode();
      return;
    }
    if (clipSync.clipFocusIndex != null) {
      clipSync.setClipFocus(null);
    }
    const lockPoint =
      clipDurations[0] > clipDurations[1]
        ? clipProgresses[0]
        : clipProgresses[1];
    clipSync.toggleLockMode({
      lockPoint,
      progresses: clipProgresses,
      durations: clipDurations,
    });
    handleClipSeek(0, lockPoint);
  }, [clipDurations, clipProgresses, clipSync, handleClipSeek]);

  const handleTrainerOverflow = useCallback(
    (action: TrainerOverflowAction) => {
      switch (action) {
        case "screenshot":
          setScreenshotPickerOpen(true);
          break;
        case "gallery":
          void screenshot.refreshScreenshots();
          setScreenshotSheetOpen(true);
          break;
        case "lock":
          handleToggleLock();
          break;
        case "audio":
          openAudioOutputPicker();
          break;
        case "record":
          if (instantRecording.trainerRecordingLive) {
            instantRecording.stopTrainerRecording();
          } else {
            instantRecording.toggleTrainerRecording();
          }
          break;
        default:
          break;
      }
    },
    [handleToggleLock, instantRecording, openAudioOutputPicker, screenshot]
  );

  const continueAfterRecap = useCallback(async () => {
    setGamePlanOpen(true);
  }, []);

  const openPostCallFlow = useCallback(async () => {
    if (postCallFlowStartedRef.current) return;
    postCallFlowStartedRef.current = true;
    onPostCallFlowStart();
    if (!isTrainer) {
      const already = await hasShownSessionRating(lessonId);
      if (!already) setRatingsOpen(true);
      else void openHandoff();
      return;
    }
    /**
     * Trainers see the recap composer FIRST (skippable). Once they send
     * or skip, we fall through to the existing screenshots / ratings
     * post-call flow via `continueAfterRecap`.
     */
    setRecapSheetOpen(true);
  }, [isTrainer, lessonId, onPostCallFlowStart, openHandoff]);

  /** Show ratings after the call ends — `endCall()` will pop us back, so we
   *  open the post-call modal FIRST (which flips the parent guard) and only
   *  then tear down the WebRTC engine. The screen stays mounted until the
   *  user dismisses ratings, at which point we navigate home. */
  const confirmExit = useCallback(() => {
    Alert.alert(
      "End session?",
      "Are you sure you want to leave this lesson?",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "End",
          style: "destructive",
          onPress: () => {
            void openPostCallFlow();
            setTimeout(() => endCall(), 0);
          },
        },
      ]
    );
  }, [endCall, openPostCallFlow]);

  const pipBounds = meetingBounds ?? { width: winW, height: winH };

  const focusPipSize = useMemo(() => {
    const fp = meetingLayout.focusPip;
    if (fp.nw != null && meetingBounds) {
      return {
        w: fp.nw * meetingBounds.width,
        h: (fp.nh ?? 0.7) * meetingBounds.height,
      };
    }
    return {
      w: fp.w > 0 ? fp.w : 100,
      h: fp.h > 0 ? fp.h : 140,
    };
  }, [meetingLayout.focusPip, meetingBounds]);

  const focusPipPosition = useMemo(() => {
    const fp = meetingLayout.focusPip;
    if (fp.nx != null && fp.ny != null && meetingBounds) {
      return { x: fp.nx * meetingBounds.width, y: fp.ny * meetingBounds.height };
    }
    if (typeof fp.x === "number" && typeof fp.y === "number") {
      return { x: fp.x, y: fp.y };
    }
    return {
      x: Math.max(0, pipBounds.width - focusPipSize.w - 12),
      y: chrome.insets.top + 88,
    };
  }, [meetingLayout.focusPip, meetingBounds, pipBounds.width, focusPipSize.w, chrome.insets.top]);

  const inClipMode = hasClipStage;
  const inLiveFocus = meetingLayout.focusedStreamId != null;

  useEffect(() => {
    if (!isTrainer || !inLiveFocus || !meetingBounds) return;
    if (meetingLayout.focusPip.nx != null) return;
    const pos = {
      x: Math.max(0, meetingBounds.width - focusPipSize.w - 12),
      y: chrome.insets.top + 88,
    };
    meetingLayout.updateFocusPip(pipPositionPatch(pos, focusPipSize));
  }, [
    isTrainer,
    inLiveFocus,
    meetingBounds,
    meetingLayout.focusPip.nx,
    meetingLayout.updateFocusPip,
    pipPositionPatch,
    focusPipSize,
    chrome.insets.top,
  ]);

  const handleAnnotationToggle = useCallback(() => {
    if (annotationToolbarOpen) {
      setAnnotationToolbarOpen(false);
      return;
    }
    if (annotationArmed) {
      setAnnotationArmed(false);
      setAnnotationToolbarOpen(false);
      drawingSync.clearCanvas();
      setDrawingOverlayKey((k) => k + 1);
      drawingSync.setTrainerDrawingEnabled(false);
      return;
    }
    setAnnotationArmed(true);
    setAnnotationToolbarOpen(true);
    drawingSync.setTrainerDrawingEnabled(true);
  }, [annotationArmed, annotationToolbarOpen, drawingSync]);

  const canDraw = isTrainer && annotationArmed;
  const bigVideoActive =
    inClipMode
      ? clipSync.clipFullscreen || clipFocusIndex != null
      : inLiveFocus;
  const focusedIsLocal = inLiveFocus && String(meetingLayout.focusedStreamId) === String(myId);

  const handleToggleBigVideo = useCallback(() => {
    if (!isTrainer) return;
    if (inClipMode) {
      if (clipFocusIndex != null) {
        clipSync.setClipFocus(null);
        return;
      }
      clipSync.toggleClipFullscreen();
      return;
    }
    if (inLiveFocus) {
      meetingLayout.clearFocus();
      return;
    }
    meetingLayout.focusStream(peerId);
  }, [
    clipFocusIndex,
    clipSync,
    inClipMode,
    inLiveFocus,
    isTrainer,
    meetingLayout,
    peerId,
  ]);

  const emitAnnotationStroke = useCallback(
    (stroke: Parameters<typeof drawingSync.emitStroke>[0], size: { width: number; height: number }) => {
      drawingSync.emitStroke(
        {
          ...stroke,
          color: stroke.color ?? annotationColor,
          width: stroke.width ?? 4,
        },
        size
      );
    },
    [annotationColor, drawingSync]
  );
  const focusedIsRemote = inLiveFocus && String(meetingLayout.focusedStreamId) === String(peerId);

  const exitClipMode = useCallback(() => {
    setActiveClipUri(null);
    clipSync.selectClip(null);
    setClipDurations([0, 0]);
    setClipProgresses([0, 0]);
    meetingLayout.clearFocus();
    clipSync.setClipFocus(null);
  }, [clipSync, meetingLayout]);

  /** Surface time-warning modals/toasts as the timer ticks past key
   *  thresholds. The 5-min and 2-min hits open a modal (trainee gets an
   *  inline "Extend" CTA); 1-min / 30s remain as informational toasts. */
  const onTimerCrossThreshold = useCallback(
    (key: "five" | "two" | "one" | "thirty") => {
      const partner = peerDisplayName;
      if (key === "five" || key === "two") {
        if (seenWarningsRef.current.has(key)) return;
        if (extensionUiBlocking) return;
        seenWarningsRef.current.add(key);
        setActiveWarning(key);
        return;
      }
      if (key === "one") {
        pushLocalToast({
          title: NOTIFICATION_TITLES.oneMinuteRemaining,
          description: `1 minute remaining. Wrap up gracefully.`,
          type: NOTIFICATION_TYPES.TRANSCATIONAL,
        });
      } else if (key === "thirty") {
        pushLocalToast({
          title: NOTIFICATION_TITLES.oneMinuteRemaining,
          description: `30 seconds remaining with ${partner}.`,
          type: NOTIFICATION_TYPES.TRANSCATIONAL,
        });
      }
    },
    [pushLocalToast, peerDisplayName, extensionUiBlocking]
  );

  /** Reset the "already shown" guards whenever the timer is extended so the
   *  next 5/2-min crossing re-opens the modal for the trainee. */
  useEffect(() => {
    if (!socket) return;
    const onExtended = (data: any) => {
      if (!data || String(data.sessionId) !== String(lessonId)) return;
      seenWarningsRef.current = new Set();
    };
    socket.on("LESSON_TIMER_EXTENDED", onExtended);
    return () => {
      socket.off("LESSON_TIMER_EXTENDED", onExtended);
    };
  }, [socket, lessonId]);

  /** Close extension UI and surface ratings once when the lesson ends. */
  const endedNotifiedRef = useRef(false);
  useEffect(() => {
    if (lessonTimer.status !== "ended") {
      endedNotifiedRef.current = false;
      return;
    }
    setTraineeExtendOpen(false);
    setActiveWarning(null);
    extensionFlow.reset();
    if (endedNotifiedRef.current) return;
    endedNotifiedRef.current = true;
    void (async () => {
      const already = await hasShownSessionRating(lessonId);
      pushLocalToast({
        title: NOTIFICATION_TITLES.sessionEnded,
        description: already
          ? "Your lesson has ended."
          : "Your lesson has ended. Tap to rate the session.",
        type: NOTIFICATION_TYPES.TRANSCATIONAL,
        bookingInfo: { lessonId },
        persistInInbox: true,
      });
      void openPostCallFlow();
    })();
  }, [lessonTimer.status, pushLocalToast, lessonId, extensionFlow, openPostCallFlow]);

  useEffect(() => {
    if (!socket || !lessonId) return;
    const onGamePlanShared = (payload: {
      sessionId?: string;
      title?: string;
      kind?: string;
    }) => {
      if (String(payload?.sessionId ?? "") !== String(lessonId)) return;
      if (isTrainer) return;
      const title =
        payload.kind === "game_plan_updated"
          ? "Game plan updated"
          : "New game plan";
      const subtitle =
        payload.title?.trim() ||
        "Your coach shared a session plan. Open Game plans in your locker.";
      setGamePlanBanner({ title, subtitle });
    };
    socket.on("GAME_PLAN_SHARED", onGamePlanShared);
    return () => {
      socket.off("GAME_PLAN_SHARED", onGamePlanShared);
    };
  }, [socket, lessonId, isTrainer]);

  useEffect(() => {
    if (!socket) return;
    const onWarning = (data: { sessionId?: string; kind?: string }) => {
      if (String(data?.sessionId) !== String(lessonId)) return;
      const kind = data?.kind;
      if (kind === "five" || kind === "two" || kind === "one" || kind === "thirty") {
        onTimerCrossThreshold(kind);
      }
    };
    socket.on("LESSON_TIME_WARNING", onWarning);
    return () => {
      socket.off("LESSON_TIME_WARNING", onWarning);
    };
  }, [socket, lessonId, onTimerCrossThreshold]);

  const handleReconnectFailedRejoin = useCallback(() => {
    void endCall();
    onRejoinLesson();
  }, [endCall, onRejoinLesson]);

  const handleReconnectFailedLeave = useCallback(() => {
    void endCall();
    onExit();
  }, [endCall, onExit]);

  const meetingStatusBanner = useMemo(
    () =>
      resolveMeetingStatusBanner({
        cameraRevoked: inCallPerms.cameraRevoked,
        partnerReconnecting: presence.partnerReconnecting,
        partnerInSession,
        hasRemoteStream: !!remoteStream,
        partnerDisconnected,
        peerDisplayName,
        isTrainer,
        trainerConnected: presence.trainerConnected,
        traineeConnected: presence.traineeConnected,
        bothJoined,
        presenceMessage: partnerInSession ? presence.presenceMessage : null,
        presenceVariant: presence.presenceVariant,
        extensionPausedHint:
          lessonTimer.status === "paused" &&
          (lessonTimer.pauseReason === "extension_pending" ||
            lessonTimer.pauseReason === "extension_accepted")
            ? "Paused — extension in progress"
            : null,
        networkOffline: !networkOnline && partnerInSession,
      }),
    [
      inCallPerms.cameraRevoked,
      presence.partnerReconnecting,
      partnerInSession,
      remoteStream,
      partnerDisconnected,
      peerDisplayName,
      isTrainer,
      presence.trainerConnected,
      presence.traineeConnected,
      bothJoined,
      presence.presenceMessage,
      presence.presenceVariant,
      lessonTimer.status,
      lessonTimer.pauseReason,
      networkOnline,
      partnerInSession,
    ]
  );

  useEffect(() => {
    setStatusBannerDismissed(false);
  }, [meetingStatusBanner?.message]);

  const networkHideLocalPip =
    networkTierConfig.hideLocalPipInClipMode && inClipMode && !inLiveFocus;

  const localStreamOffHint = streamOffHintForTile({
    isStreamOff: !cameraEnabled || !localStream,
    isLocal: true,
    localCameraOffReason,
    remoteCameraOffReason,
    videoPausedForNetwork: networkAdaptive.videoPausedForNetwork,
    partnerWeak,
  });

  const remoteStreamOffHint = streamOffHintForTile({
    isStreamOff: !remoteStream || remoteCameraOff,
    isLocal: false,
    localCameraOffReason,
    remoteCameraOffReason,
    videoPausedForNetwork: false,
    partnerWeak,
  });

  const networkBannerVisible =
    networkAdaptive.mode !== "normal" ||
    networkAdaptive.videoPausedForNetwork ||
    !!partnerQualityLabel;

  const networkBannerTop =
    chrome.insets.top + (meetingStatusBanner ? 108 : 56) + 8;

  const stackedBannerExtra =
    networkBannerVisible && partnerInSession && bothJoined ? 52 : 0;

  return (
    <View
      style={styles.root}
      pointerEvents="box-none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setMeetingBounds({ width, height });
      }}
    >
      <StatusBar barStyle="light-content" />

      <MeetingIosPipHost
        stream={remoteStream}
        enabled={partnerInSession && !!remoteStream}
      />

      {gamePlanBanner && !isTrainer ? (
        <GamePlanStatusPill
          title={gamePlanBanner.title}
          subtitle={gamePlanBanner.subtitle}
          onPress={() => {
            setGamePlanBanner(null);
            navigateToMyLocker();
          }}
          onDismiss={() => setGamePlanBanner(null)}
        />
      ) : null}

      {screenshot.capturing ? (
        <View style={styles.captureOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.captureOverlayText}>
            {screenshot.captureStage === "uploading" ? "Uploading…" : "Preparing frame…"}
          </Text>
        </View>
      ) : null}

      <ScreenshotCompositeHost
        frameUris={screenshot.compositeFrameUris}
        captureRef={screenshot.compositeHostRef}
        onLayout={() => {}}
        onFramesReady={screenshot.onCompositeFramesReady}
      />

      {/* Remote video / clip pane */}
      <View
        style={[
          styles.mainPane,
          {
            paddingTop: chrome.mainPaneTop,
            paddingBottom: chrome.mainPaneBottom,
          },
          clipSync.clipFullscreen && styles.mainPaneFullscreen,
        ]}
      >
        {!isTrainer && hasClipStage ? (
          <View style={styles.coachChipRow} pointerEvents="none">
            <MeetingCoachChip
              icon="play-circle-outline"
              label={
                traineeDroveClips
                  ? "Clips shared with coach"
                  : "Coach is controlling clips"
              }
            />
          </View>
        ) : null}
        {isTrainer && annotationArmed ? (
          <View style={[styles.coachChipRow, styles.coachChipRowDraw]} pointerEvents="none">
            <MeetingCoachChip icon="brush-outline" label="Drawing on" tone="danger" />
          </View>
        ) : null}
        {inLiveFocus ? (
          <View
            ref={screenshot.captureTargetRef}
            collapsable={false}
            style={styles.liveStage}
          >
            <MeetingLiveStage
            user={focusedIsRemote ? peerUser : null}
            stream={focusedIsLocal ? localStream : remoteStream}
            isStreamOff={
              focusedIsLocal
                ? !cameraEnabled || !localStream
                : !remoteStream || remoteCameraOff
            }
            muted={focusedIsLocal}
            label={focusedIsLocal ? "You" : peerDisplayName}
            isTrainer={isTrainer}
            onClearFocus={isTrainer ? () => meetingLayout.clearFocus() : undefined}
          />
          </View>
        ) : hasClipStage ? (
          <View
            ref={screenshot.captureTargetRef}
            collapsable={false}
            style={[
              styles.clipFrame,
              dualClip && styles.clipFrameDual,
            ]}
          >
            {lockedDualClip && clipPaneUris[0] && clipPaneUris[1] ? (
              <LockedDualClipStage
                uris={[clipPaneUris[0], clipPaneUris[1]]}
                makePaneProps={makeClipPlayerProps}
                isTrainer={isTrainer}
                isPlaying={clipSync.isPlaying}
                progressSeconds={lockedProgress}
                durationSeconds={lockedDuration}
                onTogglePlay={handleLockedClipTogglePlay}
                onSeek={(sec) => handleClipSeek(0, sec)}
                capturing={screenshot.capturing}
              />
            ) : dualClip && clipPaneUris[0] && clipPaneUris[1] ? (
              <UnlockedDualClipStage
                uris={[clipPaneUris[0], clipPaneUris[1]]}
                makePaneProps={makeClipPlayerProps}
                isTrainer={isTrainer}
                isPlayingByPane={[
                  clipSync.isClipPlaying(
                    clipSync.selectedClips[0]
                      ? clipIdOf(clipSync.selectedClips[0])
                      : null
                  ),
                  clipSync.isClipPlaying(
                    clipSync.selectedClips[1]
                      ? clipIdOf(clipSync.selectedClips[1])
                      : null
                  ),
                ]}
                progressSecondsByPane={[
                  clipProgresses[0] ?? 0,
                  clipProgresses[1] ?? 0,
                ]}
                durationSecondsByPane={[
                  clipDurations[0] ?? 0,
                  clipDurations[1] ?? 0,
                ]}
                onTogglePlay={(paneIndex) => handleClipTogglePlay(paneIndex)}
                onSeek={(paneIndex, sec) => handleClipSeek(paneIndex, sec)}
                clipFocusIndex={clipFocusIndex}
                onToggleExpand={(paneIndex) =>
                  clipSync.setClipFocus(
                    clipFocusIndex === paneIndex ? null : paneIndex
                  )
                }
                capturing={screenshot.capturing}
              />
            ) : (
              <View style={styles.singleClip}>
                {(() => {
                  const singlePane = makeClipPlayerProps(0);
                  return (
                    <View style={styles.singleClipPlayer}>
                      <ClipPlayer uri={activeClipUri!} {...singlePane} />
                      {!screenshot.capturing &&
                      singlePane.showZoomControls &&
                      singlePane.onZoomIn &&
                      singlePane.onZoomOut ? (
                        <ClipZoomControls
                          onZoomIn={singlePane.onZoomIn}
                          onZoomOut={singlePane.onZoomOut}
                        />
                      ) : null}
                    </View>
                  );
                })()}
                {isTrainer && !screenshot.capturing ? (
                  <ClipPlaybackControls
                    size="compact"
                    isPlaying={clipSync.isClipPlaying(
                      clipSync.selectedClips[0]
                        ? clipIdOf(clipSync.selectedClips[0])
                        : null
                    )}
                    onTogglePlay={handleSingleClipTogglePlay}
                    progressSeconds={clipProgresses[0]}
                    durationSeconds={clipDurations[0]}
                    onSeek={(sec) => handleClipSeek(0, sec)}
                    disabled={!activeClipUri}
                    bottomOffset={chrome.clipControlsBottom}
                  />
                ) : null}
              </View>
            )}
          </View>
        ) : (
          <View
            ref={screenshot.captureTargetRef}
            collapsable={false}
            style={styles.liveStage}
          >
            <DualLiveStage
              localUser={
                authUser
                  ? {
                      _id: String(authUser._id ?? myId),
                      fullname:
                        (authUser as { fullname?: string }).fullname ??
                        (authUser as { fullName?: string }).fullName,
                      profile_picture: (authUser as { profile_picture?: string })
                        .profile_picture,
                    }
                  : null
              }
              remoteUser={peerUser}
              localStream={localStream}
              remoteStream={remoteStream}
              localStreamOff={!cameraEnabled || !localStream}
              remoteStreamOff={!remoteStream || remoteCameraOff}
              localLabel="You"
              remoteLabel={peerDisplayName}
              onSelectLocal={
                isTrainer ? () => meetingLayout.focusStream(myId) : undefined
              }
              onSelectRemote={() => meetingLayout.focusStream(peerId)}
            />
          </View>
        )}
        <DrawingOverlay
          key={`stage-${drawingOverlayKey}`}
          enabled={canDraw}
          showRemoteLayer={!isTrainer}
          tool={annotationTool}
          color={annotationColor}
          remoteStrokes={drawingSync.remoteStrokes}
          onStrokeComplete={emitAnnotationStroke}
        />
      </View>

      {meetingStatusBanner && !statusBannerDismissed ? (
        <MeetingJoinBanner
          message={meetingStatusBanner.message}
          variant={meetingStatusBanner.variant}
          topOffset={chrome.insets.top + 48}
          onDismiss={() => setStatusBannerDismissed(true)}
        />
      ) : null}

      {partnerInSession && bothJoined && !networkBannerDismissed ? (
        <NetworkLessonBanner
          mode={networkAdaptive.mode}
          videoPausedForNetwork={networkAdaptive.videoPausedForNetwork}
          partnerQualityLabel={partnerQualityLabel}
          usingRelay={networkAdaptive.usingRelay}
          topOffset={networkBannerTop}
          onDismiss={() => setNetworkBannerDismissed(true)}
          onTurnVideoBackOn={() => {
            networkAdaptive.markManualVideoRestore();
            if (!cameraEnabled) toggleCamera();
          }}
        />
      ) : null}

      {!isTrainer && !agendaBannerDismissed ? (
        <MeetingAgendaBanner
          focusedClipTitle={lessonLive.liveState.focusedClipTitle}
          topOffset={
            chrome.insets.top +
            (meetingStatusBanner && !statusBannerDismissed ? 108 : 56) +
            stackedBannerExtra
          }
          onDismiss={() => setAgendaBannerDismissed(true)}
        />
      ) : null}

      {!isTrainer && partnerInSession ? (
        <MeetingPaymentSummaryChip
          sessionId={lessonId}
          enabled={partnerInSession}
          topOffset={
            chrome.insets.top +
            (meetingStatusBanner ? 108 : 56) +
            stackedBannerExtra +
            (!isTrainer ? 44 : 0)
          }
        />
      ) : null}

      <MeetingPeerJoinedToast topOffset={chrome.insets.top + (meetingStatusBanner ? 108 : 48)} />

      {inLiveFocus ? (
        <>
          <DraggableVideoPip
            tileId={focusedIsLocal ? "remote" : "local"}
            user={focusedIsLocal ? peerUser : null}
            stream={focusedIsLocal ? remoteStream : localStream}
            isStreamOff={
              focusedIsLocal
                ? !remoteStream || remoteCameraOff
                : !cameraEnabled || !localStream
            }
            streamOffHint={focusedIsLocal ? remoteStreamOffHint : localStreamOffHint}
            muted={!focusedIsLocal}
            fallbackLabel={focusedIsLocal ? peerDisplayName : "You"}
            tabLabel={focusedIsLocal ? peerDisplayName.split(" ")[0] || "Partner" : "You"}
            bounds={pipBounds}
            safeTop={chrome.insets.top}
            safeBottom={chrome.insets.bottom}
            pipReservedBottom={chrome.pipSafeBottom}
            position={focusPipPosition}
            isHidden={false}
            hiddenEdge={meetingLayout.focusPip.hiddenEdge ?? "right"}
            width={focusPipSize.w}
            height={focusPipSize.h}
            disabled={!isTrainer}
            onPositionChange={(pos) => {
              meetingLayout.updateFocusPip(pipPositionPatch(pos, focusPipSize));
            }}
            onHide={(_edge, _last) => {}}
            onRestore={() => {}}
            onExpand={
              isTrainer
                ? () => meetingLayout.focusStream(focusedIsLocal ? peerId : myId)
                : undefined
            }
            onSizeChange={(w, h) => {
              if (isTrainer) {
                meetingLayout.updateFocusPip(
                  pipPositionPatch(focusPipPosition, { w, h })
                );
              }
            }}
          />
          {inClipMode && activeClipUri ? (
            <ClipMiniPip
              uri={activeClipUri}
              label="Clips"
              bottomOffset={chrome.pipSafeBottom}
              onPress={() => meetingLayout.clearFocus()}
            />
          ) : null}
        </>
      ) : inClipMode ? (
        <>
          <DraggableVideoPip
            tileId="local"
            user={null}
            stream={localStream}
            isStreamOff={!cameraEnabled || !localStream}
            streamOffHint={localStreamOffHint}
            muted
            fallbackLabel="You"
            tabLabel="You"
            bounds={pipBounds}
            safeTop={chrome.insets.top}
            safeBottom={chrome.insets.bottom}
            pipReservedBottom={chrome.pipSafeBottom}
            position={pipLayout.pipLayout.local.position}
            isHidden={pipLayout.pipLayout.local.isHidden || networkHideLocalPip}
            hiddenEdge={pipLayout.pipLayout.local.hiddenEdge}
            width={localPipSize.w}
            height={localPipSize.h}
            onPositionChange={(pos) => {
              pipLayout.updatePosition("local", pos);
              meetingLayout.updateTile("local", pipPositionPatch(pos, localPipSize));
            }}
            onHide={(edge, last) => {
              pipLayout.hideTile("local", edge, last);
              meetingLayout.updateTile("local", {
                hidden: true,
                hiddenEdge: edge,
                ...pipPositionPatch(last, localPipSize),
              });
            }}
            onRestore={() => {
              pipLayout.restoreTile("local");
              meetingLayout.updateTile("local", { hidden: false });
            }}
            onExpand={
              isTrainer ? () => meetingLayout.focusStream(myId) : undefined
            }
            onSizeChange={(w, h) => {
              setLocalPipSize({ w, h });
              if (isTrainer) {
                meetingLayout.updateTile(
                  "local",
                  pipPositionPatch(pipLayout.pipLayout.local.position, { w, h })
                );
              }
            }}
          />
          <DraggableVideoPip
            tileId="remote"
            user={peerUser}
            stream={remoteStream}
            isStreamOff={!remoteStream || remoteCameraOff}
            streamOffHint={remoteStreamOffHint}
            tabLabel={peerDisplayName.split(" ")[0] || "Partner"}
            bounds={pipBounds}
            safeTop={chrome.insets.top}
            safeBottom={chrome.insets.bottom}
            pipReservedBottom={chrome.pipSafeBottom}
            position={pipLayout.pipLayout.remote.position}
            isHidden={pipLayout.pipLayout.remote.isHidden}
            hiddenEdge={pipLayout.pipLayout.remote.hiddenEdge}
            width={remotePipSize.w}
            height={remotePipSize.h}
            onPositionChange={(pos) => {
              pipLayout.updatePosition("remote", pos);
              meetingLayout.updateTile("remote", pipPositionPatch(pos, remotePipSize));
            }}
            onHide={(edge, last) => {
              pipLayout.hideTile("remote", edge, last);
              meetingLayout.updateTile("remote", {
                hidden: true,
                hiddenEdge: edge,
                ...pipPositionPatch(last, remotePipSize),
              });
            }}
            onRestore={() => {
              pipLayout.restoreTile("remote");
              meetingLayout.updateTile("remote", { hidden: false });
            }}
            onExpand={
              isTrainer ? () => meetingLayout.focusStream(peerId) : undefined
            }
            onSizeChange={(w, h) => {
              setRemotePipSize({ w, h });
              if (isTrainer) {
                meetingLayout.updateTile(
                  "remote",
                  pipPositionPatch(pipLayout.pipLayout.remote.position, { w, h })
                );
              }
            }}
          />
        </>
      ) : null}

      {instantRecording.showRecordingBar ? (
        <RecordingBar
          active
          onStop={
            isTrainer ? instantRecording.stopTrainerRecording : undefined
          }
        />
      ) : null}

      {!isTrainer && instantRecording.traineeNoticeOpen ? (
        <View
          style={[styles.recordNotice, { top: chrome.insets.top + 100 }]}
          pointerEvents="box-none"
        >
          <View style={styles.recordNoticeCard}>
            <Text style={styles.recordNoticeTitle}>Lesson is being recorded</Text>
            <Text style={styles.recordNoticeBody}>
              Your coach enabled session recording for this instant lesson.
            </Text>
            <Pressable
              onPress={instantRecording.dismissTraineeNotice}
              style={styles.recordNoticeBtn}
            >
              <Text style={styles.recordNoticeBtnText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {instantRecording.uploading ? (
        <View style={[styles.recordNotice, { top: chrome.insets.top + 100 }]}>
          <View style={styles.recordNoticeCard}>
            <ActivityIndicator color="#fff" />
            <Text style={[styles.recordNoticeBody, { marginTop: 8 }]}>
              Uploading session recording…
            </Text>
          </View>
        </View>
      ) : null}

      {instantRecording.showTrainerRecordingOptIn &&
      isTrainer &&
      isInstant &&
      lessonTimer.status === "waiting" ? (
        <Pressable
          style={[
            styles.recordOptIn,
            { top: chrome.insets.top + 52 },
            instantRecording.trainerRecordingEnabled && styles.recordOptInOn,
          ]}
          onPress={instantRecording.toggleTrainerRecording}
        >
          <Text style={styles.recordOptInText}>
            {instantRecording.trainerRecordingEnabled
              ? "Recording on"
              : "Record session"}
          </Text>
        </Pressable>
      ) : null}

      {/* Connection quality pill - overlay above the timer in top-left */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: chrome.topChrome,
          left: 12,
          zIndex: 20,
        }}
      >
        <ConnectionQualityPill
          videoPausedForNetwork={networkAdaptive.videoPausedForNetwork}
        />
        {!isTrainer ? (
          <View style={{ marginTop: 8 }}>
            <TopToolButton
              onPress={openAudioOutputPicker}
              label={`Audio: ${audioRoute.routeLabel}`}
            >
              <Ionicons name="volume-high-outline" size={16} color={meetingTheme.text} />
            </TopToolButton>
          </View>
        ) : null}
      </View>

      {/* Top chrome */}
      <TimeRemaining
        remainingSeconds={lessonTimer.remainingSeconds}
        isAuthoritative={lessonTimer.isAuthoritative}
        status={lessonTimer.status}
        bothUsersJoined={bothUsersForTimer}
        statusHint={timerStatusHint}
        showCoachControls={isTrainer}
        variant={isInstant ? "instant" : "scheduled"}
        timerLabel="Timer"
        topInset={chrome.topChrome}
        alignRight
        onStart={lessonTimer.requestStart}
        onPause={lessonTimer.requestPause}
        onResume={lessonTimer.requestResume}
        onCrossThreshold={onTimerCrossThreshold}
        leadingTools={
          isTrainer && partnerInSession && bothJoined ? (
            <MeetingTrainerOverflowMenu
              disabled={screenshot.capturing}
              onSelect={handleTrainerOverflow}
              items={[
                {
                  id: "screenshot",
                  label: "Screenshot",
                  icon: "camera-outline",
                  disabled: screenshot.capturing,
                },
                {
                  id: "gallery",
                  label: "Screenshot gallery",
                  icon: "images-outline",
                },
                ...(clipSync.selectedClips.length === 2
                  ? [
                      {
                        id: "lock" as const,
                        label: clipSync.lockMode ? "Unlock clips" : "Lock clips",
                        icon: (clipSync.lockMode
                          ? "lock-closed"
                          : "lock-open-outline") as keyof typeof Ionicons.glyphMap,
                        active: clipSync.lockMode,
                      },
                    ]
                  : []),
                {
                  id: "audio",
                  label: `Audio · ${audioRoute.routeLabel}`,
                  icon: "volume-high-outline",
                },
                ...(instantRecording.showTrainerRecordingOptIn &&
                isInstant &&
                lessonTimer.status !== "waiting"
                  ? [
                      {
                        id: "record" as const,
                        label: instantRecording.trainerRecordingLive
                          ? "Stop recording"
                          : instantRecording.trainerRecordingEnabled
                            ? "Start recording"
                            : "Record session",
                        icon: "radio-button-on" as keyof typeof Ionicons.glyphMap,
                        active:
                          instantRecording.trainerRecordingLive ||
                          instantRecording.trainerRecordingEnabled,
                      },
                    ]
                  : []),
              ]}
            />
          ) : !isTrainer && joinReadiness?.extension_preview?.allowed ? (
            <TopToolButton
              onPress={() => setTraineeExtendOpen(true)}
              label="Extend session"
            >
              <Ionicons name="add-circle-outline" size={18} color={meetingTheme.text} />
            </TopToolButton>
          ) : undefined
        }
      />

      {isTrainer && annotationToolbarOpen ? (
        <MeetingAnnotationToolbar
          tool={annotationTool}
          strokeColor={annotationColor}
          onToolChange={setAnnotationTool}
          onColorChange={setAnnotationColor}
          drawingEnabled={annotationArmed}
          onToggleDrawing={() => setAnnotationToolbarOpen(false)}
          onClear={() => {
            drawingSync.clearCanvas();
            setDrawingOverlayKey((k) => k + 1);
          }}
          onUndo={() => {
            if (drawingSync.undoLastStroke()) {
              setDrawingOverlayKey((k) => k + 1);
            }
          }}
          canUndo={drawingSync.canUndo}
          bottomOffset={chrome.bottomChrome + 96}
        />
      ) : null}

      {isTrainer ? (
        <MeetingLiveNotesPanel
          notes={lessonLive.visibleNotes}
          elapsedSeconds={elapsedLessonSeconds}
          onAddNote={(text, shared) =>
            lessonLive.addLiveNote(text, elapsedLessonSeconds, shared)
          }
          bottomOffset={chrome.bottomChrome + 88}
        />
      ) : (
        <MeetingTraineeNotesPanel
          notes={lessonLive.visibleNotes}
          topOffset={chrome.insets.top + 100 + stackedBannerExtra}
        />
      )}

      {/* Bottom chrome */}
      <View
        pointerEvents={reconnectFailed ? "none" : "auto"}
        style={{ opacity: reconnectFailed ? 0.35 : 1 }}
      >
      <ActionButtons
        isTrainer={isTrainer}
        bottomInset={chrome.bottomChrome}
        audioRouteLabel={audioRoute.routeLabel}
        onToggleAudioRoute={isTrainer ? undefined : audioRoute.toggleAudioRoute}
        onEndCall={confirmExit}
        inClipMode={inClipMode}
        onToggleBigVideo={isTrainer ? handleToggleBigVideo : undefined}
        bigVideoActive={bigVideoActive}
        onExitClipMode={isTrainer ? exitClipMode : undefined}
        annotationArmed={annotationArmed}
        onToggleDrawing={isTrainer ? handleAnnotationToggle : undefined}
        onOpenClipPicker={() => setPickerOpen(true)}
      />
      </View>

      {reconnectFailed ? (
        <ReconnectFailedOverlay
          onRejoin={handleReconnectFailedRejoin}
          onLeave={handleReconnectFailedLeave}
        />
      ) : null}

      {lastError && !errorBannerDismissed ? (
        <View
          style={[
            styles.errorBanner,
            { top: chrome.insets.top + (reconnectFailed ? 56 : 8) },
          ]}
        >
          <View style={styles.errorBannerBody}>
            <Text style={styles.errorText}>{lastError}</Text>
            {joinDeniedCanTakeOver ? (
              <Pressable
                onPress={requestCallTakeover}
                style={styles.takeoverBtn}
                accessibilityRole="button"
                accessibilityLabel="Take over lesson on this device"
              >
                <Text style={styles.takeoverBtnText}>Take over on this device</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => {
              setErrorBannerDismissed(true);
              clearLastError();
            }}
            style={styles.errorDismissBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss error"
          >
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
        </View>
      ) : null}


      <ClipPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        audience={isTrainer ? "trainer" : "trainee"}
        onDone={isTrainer ? handleClipsPicked : handleTraineeClipsPicked}
        bookingClips={sessionBookingClips as ClipRow[]}
        traineeId={
          isTrainer ? String(session?.trainee_info?._id ?? "") : undefined
        }
        selectedClipIds={clipSync.selectedClips
          .map((c) => clipIdOf(c))
          .filter((id): id is string => !!id)}
      />

      {isTrainer ? (
        <>
          <SessionScreenshotSheet
            visible={screenshotSheetOpen}
            sessionId={lessonId}
            trainerId={myId}
            traineeId={peerId}
            extraKeys={screenshot.screenshotKeys}
            onClose={() => setScreenshotSheetOpen(false)}
          />
          <SessionScreenshotDetailsModal
            visible={screenshotDetailsOpen}
            sessionId={lessonId}
            trainerId={myId}
            traineeId={peerId}
            imageKey={pendingScreenshotKey}
            previewUri={pendingScreenshotPreviewUri}
            onClose={() => {
              setScreenshotDetailsOpen(false);
              setPendingScreenshotKey(null);
              setPendingScreenshotPreviewUri(null);
              screenshot.disposePendingPreview?.();
            }}
            onSaved={() => {
              void screenshot.refreshScreenshots();
              setScreenshotSheetOpen(true);
            }}
          />
          <ScreenshotCapturePickerModal
            visible={screenshotPickerOpen}
            hasDualClips={dualClip}
            inLiveFocus={inLiveFocus}
            clipLabels={clipScreenshotLabels}
            onClose={() => setScreenshotPickerOpen(false)}
            onSelect={handleScreenshotChoice}
          />
          <SessionGamePlanModal
            visible={gamePlanOpen}
            sessionId={lessonId}
            trainerId={myId}
            traineeId={peerId}
            trainerName={
              (authUser as { fullname?: string })?.fullname ??
              (authUser as { fullName?: string })?.fullName
            }
            onClose={() => {
              setGamePlanOpen(false);
              setRatingsOpen(true);
            }}
          />
        </>
      ) : null}

      {/* Two-party paid extension flow. The hook drives which modal renders;
          mounted once for both roles. */}
      {!isTrainer ? (
        <SessionExtensionModal
          visible={traineeExtendOpen}
          sessionId={lessonId}
          trainerId={String(session?.trainer_id ?? session?.trainerId ?? "")}
          remainingSeconds={lessonTimer.remainingSeconds}
          flow={extensionFlow}
          onDismiss={() => setTraineeExtendOpen(false)}
        />
      ) : null}
      {isTrainer ? (
        <TrainerExtensionRequestModal
          flow={extensionFlow}
          traineeName={peerDisplayName}
        />
      ) : null}

      <SessionTimeWarningModal
        visible={timeWarningVisible}
        kind={activeWarning ?? "five"}
        audience={isTrainer ? "trainer" : "trainee"}
        canExtend={!isTrainer && activeWarning === "two"}
        onExtend={() => {
          setActiveWarning(null);
          setTraineeExtendOpen(true);
        }}
        onQuickExtendTenMin={
          !isTrainer &&
          activeWarning === "two" &&
          joinReadiness?.extension_preview?.allowed
            ? async () => {
                setActiveWarning(null);
                try {
                  await extensionFlow.requestExtension(10);
                  setTraineeExtendOpen(true);
                } catch {
                  setTraineeExtendOpen(true);
                }
              }
            : undefined
        }
        quickExtendPrice={joinReadiness?.extension_preview?.amount}
        quickExtendCurrency="$"
        onDismiss={() => setActiveWarning(null)}
      />

      <RatingsModal
        visible={ratingsOpen}
        onClose={() => {
          setRatingsOpen(false);
          void openHandoff();
        }}
        onSkip={() => {
          if (!isTrainer) return;
          void markSessionRatingShown(lessonId);
          if (endedNotifiedRef.current || lessonTimer.status === "ended") {
            void stashPendingSessionRating(lessonId);
          }
        }}
        onSubmitted={() => {
          void markSessionRatingShown(lessonId);
          if (!isTrainer) {
            setRatingsOpen(false);
            void openHandoff();
          }
        }}
        bookingId={lessonId}
        accountType={accountType}
        isFromCall
      />

      {isTrainer ? (
        <SessionRecapSheet
          visible={recapSheetOpen}
          sessionId={String(lessonId)}
          traineeId={peerId}
          traineeName={peerDisplayName}
          onClose={() => {
            setRecapSheetOpen(false);
            void continueAfterRecap();
          }}
          onSent={() => {
            setRecapSheetOpen(false);
            void continueAfterRecap();
          }}
        />
      ) : null}

      <SessionHandoffScreen
        visible={handoffOpen}
        loading={handoffLoading}
        summary={handoffSummary}
        isTrainer={isTrainer}
        onRate={() => {
          setHandoffOpen(false);
          setRatingsOpen(true);
        }}
        onRetry={() => void openHandoff()}
        onRebook={
          !isTrainer && handoffSummary?.can_rebook && handoffSummary?.peer?._id
            ? () => {
                setHandoffOpen(false);
                onExit();
                navigateToBookTrainer(handoffSummary.peer!._id);
              }
            : undefined
        }
        onDone={() => {
          setHandoffOpen(false);
          onExit();
        }}
      />
    </View>
  );
}

function TopToolButton({
  children,
  onPress,
  label,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        topToolStyles.btn,
        active && topToolStyles.btnActive,
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.45 },
      ]}
    >
      {children}
    </Pressable>
  );
}

const topToolStyles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: meetingTheme.barBg,
    borderWidth: 1,
    borderColor: meetingTheme.barBorder,
  },
  btnActive: {
    borderColor: meetingTheme.text,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: meetingTheme.background,
  },
  mainPane: {
    flex: 1,
    paddingHorizontal: 12,
  },
  mainPaneFullscreen: {
    paddingHorizontal: 0,
  },
  clipFrame: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: meetingTheme.border,
  },
  liveStage: {
    flex: 1,
  },
  livePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: meetingTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: meetingTheme.border,
  },
  livePlaceholderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: meetingTheme.text,
    textAlign: "center",
  },
  livePlaceholderSub: {
    marginTop: 8,
    fontSize: 14,
    color: meetingTheme.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  clipFrameDual: {
    borderRadius: 12,
  },
  singleClip: {
    flex: 1,
    overflow: "hidden",
  },
  singleClipPlayer: {
    flex: 1,
    position: "relative",
  },
  dualColumn: {
    flex: 1,
    flexDirection: "column",
    gap: 6,
  },
  dualPane: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: meetingTheme.surface,
    minHeight: 120,
  },
  dualPaneFocused: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: meetingTheme.background,
    padding: 24,
    gap: 12,
  },
  centerText: { color: meetingTheme.textMuted, textAlign: "center", fontSize: 14 },
  centerTitle: {
    color: meetingTheme.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  permBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: NAVY,
  },
  permBtnSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  permBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  permBtnTextSecondary: { color: "#ccc" },
  errorBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(244,67,54,0.92)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    zIndex: 30,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  errorText: { color: "#fff", fontSize: 13 },
  errorBannerBody: { flex: 1, gap: 8 },
  errorDismissBtn: {
    padding: 2,
    marginLeft: 4,
  },
  takeoverBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  takeoverBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  coachChipRow: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    zIndex: 12,
  },
  coachChipRowDraw: {
    top: 40,
  },
  captureOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    gap: 10,
  },
  captureOverlayText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  recordOptIn: {
    position: "absolute",
    right: 16,
    zIndex: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  recordOptInOn: {
    backgroundColor: "rgba(229,57,53,0.85)",
    borderColor: "rgba(229,57,53,0.9)",
  },
  recordOptInText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  recordNotice: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 26,
    alignItems: "center",
  },
  recordNoticeCard: {
    maxWidth: 340,
    width: "100%",
    backgroundColor: "rgba(15,23,42,0.92)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  recordNoticeTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  recordNoticeBody: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    lineHeight: 18,
  },
  recordNoticeBtn: {
    marginTop: 12,
    alignSelf: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: meetingTheme.accent,
  },
  recordNoticeBtnText: {
    color: meetingTheme.onPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
});
