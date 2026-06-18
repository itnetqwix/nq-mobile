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
import { useMeetingAnnotationStore } from "../../../stores/meetingAnnotationStore";
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
import {
  ACTION_BAR_HEIGHT,
  ANNOTATION_TOOLBAR_HEIGHT,
  useMeetingChromeInsets,
} from "../useMeetingChromeInsets";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../../navigation/types";
import { AccountType } from "../../../constants/accountType";
import { useAuth } from "../../auth/context/AuthContext";
import { useSocket } from "../../socket/SocketContext";
import { queryKeys } from "../../../lib/queryKeys";
import { invalidateSessions } from "../../../lib/queryInvalidation";
import { fetchMeetingSession, fetchScheduledMeetings } from "../../home/api/homeApi";
import { parseIceServersFromSession } from "../meetingIceServers";
import { sanitizeIceServers } from "../iceServers";
import { fetchSessionReport } from "../meetingReportApi";
import { parseReportScreenshotItems } from "../reportDataUtils";
import { getClipPlaybackUrl } from "../../../lib/clipMediaUrl";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import {
  clipIdOf,
  mergeSessionClips,
  playableBookingClips,
  resolveClipPlayback,
} from "../clipSyncUtils";
import { useDrawingSync } from "../useDrawingSync";
import { useMeetingScreenshot } from "../useMeetingScreenshot";

import { CallProvider, useCall } from "../CallContext";
import { CALL_EVENTS } from "../callEvents";
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
  defaultPipPosition,
  PIP_HEIGHT,
  PIP_WIDTH,
  type PipEdge,
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
import {
  CLIP_MODE_PIP,
  defaultClipModeLocalPipLayout,
  defaultClipModeRemotePipLayout,
  defaultLocalPipLayout,
  resolveTilePosition,
  resolveTileSize,
} from "../meetingTileUtils";
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
import { ConnectionQualityPill } from "../components/ConnectionQualityPill";
import { NetworkLessonBanner } from "../components/NetworkLessonBanner";
import {
  MeetingTrainerOverflowMenu,
  type TrainerOverflowAction,
} from "../components/MeetingTrainerOverflowMenu";
import { ClipPickerModal } from "../components/ClipPickerModal";
import { LockedDualClipStage } from "../components/LockedDualClipStage";
import { UnlockedDualClipStage } from "../components/UnlockedDualClipStage";
import type { ClipAnnotationLayout, ContentRect } from "../annotationCoords";
import { resolveClipContentInsets } from "../annotationCoords";
import type { AnnotationProjectionOptions } from "../annotationRenderUtils";
import { ClipPlayer, type ZoomPanEmitMode } from "../components/ClipPlayer";
import { ClipZoomControls } from "../components/ClipZoomControls";
import { ClipPlaybackControls } from "../components/ClipPlaybackControls";
import { DrawingOverlay } from "../components/DrawingOverlay";
import {
  MeetingAnnotationToolbar,
} from "../components/MeetingAnnotationToolbar";
import { SessionGamePlanModal } from "../components/SessionGamePlanModal";
import { SessionScreenshotSheet } from "../components/SessionScreenshotSheet";
import { SessionScreenshotDetailsModal } from "../components/SessionScreenshotDetailsModal";
import { ScreenshotCompositeHost } from "../components/ScreenshotCompositeHost";
import {
  AnnotationBurnInHost,
  type AnnotationBurnInHostHandle,
} from "../components/AnnotationBurnInHost";
import { LiveVideoCaptureHost } from "../components/LiveVideoCaptureHost";
import { DualVideoStrip } from "../components/DualVideoStrip";
import {
  captureLiveVideoFrame,
  isMediaStreamVideoReady,
} from "../captureLiveVideoFrame";
import { useScreenshotUploadRetry } from "../useScreenshotUploadRetry";
import {
  enqueueScreenshotUpload,
  replaceQueuedUploadUri,
} from "../screenshotUploadQueue";
import type { MediaStream } from "react-native-webrtc";
import { RecordingBar } from "../components/RecordingBar";
import { useInstantLessonRecording } from "../useInstantLessonRecording";
import { persistTraineeClipsOnBooking } from "../traineeMidLessonClips";
import type { ClipRow } from "../../instant-lesson/instantLessonClipsApi";
import { RatingsModal } from "../components/RatingsModal";
import { MeetingJoinBanner } from "../components/MeetingJoinBanner";
import { SessionRecapSheet } from "../components/SessionRecapSheet";
import { MeetingAgendaBanner } from "../components/MeetingAgendaBanner";
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
import { useSessionDeparture } from "../useSessionDeparture";
import { SessionDepartureModal } from "../components/SessionDepartureModal";
import { SessionRejoinBlockedModal } from "../components/SessionRejoinBlockedModal";
import { ExtensionWaitingForCoachModal } from "../components/ExtensionWaitingForCoachModal";
import { useLiveLessonUxState } from "../useLiveLessonUxState";
import { initiateSessionDeparture } from "../../home/api/homeApi";
import { reportOpsEvent } from "../../ops/opsEventsApi";
import { meetingTheme } from "../meetingTheme";
import { useSessionExtensionFlow } from "../useSessionExtensionFlow";
import { SessionExtensionModal } from "../components/SessionExtensionModal";
import { TrainerExtensionRequestModal } from "../components/TrainerExtensionRequestModal";
import {
  SessionTimeWarningModal,
  type SessionWarningKind,
} from "../components/SessionTimeWarningModal";
import {
  escrowMilestoneFromTimerWarning,
  type EscrowMilestone,
} from "../escrowMilestone";

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

  const { data: joinReadiness } = useQuery({
    queryKey: queryKeys.sessions.joinReadiness(lessonId),
    enabled: !!lessonId,
    queryFn: () => fetchSessionJoinReadiness(lessonId),
    staleTime: 60_000,
  });

  const session = useMemo<SessionRow | null>(() => {
    if (!cached && !fetched) return null;
    const merged: SessionRow = { ...(cached ?? {}), ...(fetched ?? {}) };
    const populated = fetched?.trainee_clips ?? cached?.trainee_clips;
    if (Array.isArray(populated) && populated.length > 0) {
      merged.trainee_clips = populated;
    }
    const clips = mergeSessionClips(merged, joinReadiness?.clips);
    if (clips.length > 0) {
      merged.trainee_clips = clips;
    }
    return merged;
  }, [cached, fetched, joinReadiness?.clips]);

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
  /** Initiator tapped End — wait for partner departure response before going home. */
  const awaitingDepartureRef = useRef(false);
  /**
   * Set when the PEER explicitly presses "End call". In this case
   * the trainee should NOT be navigated home — MeetingSurface will open their
   * post-call flow (ratings + handoff). We only stash a drop record when a
   * call tears down for unknown reasons (ICE failure etc.), not a clean end.
   */
  const peerEndedCallRef = useRef(false);
  const [peerEndedCall, setPeerEndedCall] = useState(false);
  const peerNameRef = useRef<string | undefined>(undefined);
  const goHome = useCallback(() => {
    postCallActiveRef.current = false;
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  }, [navigation]);
  const onDepartureInitiated = useCallback(() => {
    awaitingDepartureRef.current = true;
  }, []);

  const handleCallEnded = useCallback(() => {
    if (awaitingDepartureRef.current) {
      return;
    }
    if (postCallActiveRef.current) {
      /**
       * Post-call flow is currently open (ratings / game-plan / handoff modals
       * are visible). Don't navigate away — the modals call goHome() themselves
       * via onDone / onExit once the user finishes. Navigating here would
       * unmount everything before the user sees the post-call UI.
       */
      return;
    }
    if (peerEndedCallRef.current) {
      /**
       * Peer (trainer) explicitly ended the lesson. MeetingSurface is already
       * opening the post-call flow via onPeerEndedLesson — don't navigate home
       * here; let the user complete their ratings and handoff normally.
       */
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
    awaitingDepartureRef.current = false;
    postCallActiveRef.current = true;
    try {
      const { setLastInterruptedSession } = require("../callRejoinStore");
      setLastInterruptedSession(null);
    } catch {
      /* noop */
    }
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

  const { data: joinReadinessForIce } = useQuery({
    queryKey: queryKeys.sessions.joinReadiness(lessonId),
    queryFn: () => fetchSessionJoinReadiness(lessonId),
    staleTime: 60_000,
  });

  const iceServers = useMemo(() => {
    const fromReadiness = (joinReadinessForIce?.iceServers ?? []) as import("../types").IceServer[];
    const raw =
      fromReadiness.length > 0 ? fromReadiness : parseIceServersFromSession(session);
    return raw ? sanitizeIceServers(raw) : undefined;
  }, [joinReadinessForIce, session]);

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
        /* Join UX: MeetingPeerJoinedToast only (deduped in CallContext). */
      }}
      onPeerDisconnected={() => {
        pushLocalToast({
          title: NOTIFICATION_TITLES.peerLeftCall,
          description: `${peerDisplayName} disconnected. Waiting for them to rejoin…`,
          type: NOTIFICATION_TYPES.TRANSCATIONAL,
        });
      }}
      onPeerLeft={() => {
        peerEndedCallRef.current = true;
        setPeerEndedCall(true);
        pushLocalToast({
          title: NOTIFICATION_TITLES.peerLeftCall,
          description: `${peerDisplayName} ended the call. You'll be asked whether to end the session.`,
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
        onDepartureInitiated={onDepartureInitiated}
        peerEndedCall={peerEndedCall}
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
  onDepartureInitiated,
  peerEndedCall = false,
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
  /** Parent sets awaiting-departure ref so engine teardown does not navigate home. */
  onDepartureInitiated?: () => void;
  /**
   * Flips to `true` when the remote peer explicitly presses "End call".
   */
  peerEndedCall?: boolean;
  myId: string;
  peerId: string;
  peerDisplayName: string;
}) {
  const { user: authUser } = useAuth();
  const audioRoute = useAudioRoute();

  const { data: joinReadiness } = useQuery({
    queryKey: queryKeys.sessions.joinReadiness(lessonId),
    queryFn: () => fetchSessionJoinReadiness(lessonId),
    staleTime: 60_000,
  });

  const sessionBookingClips = useMemo(
    () => playableBookingClips(session, joinReadiness?.clips),
    [session, joinReadiness?.clips]
  );
  const [activeClipUri, setActiveClipUri] = useState<string | null>(null);
  const { width: winW, height: winH } = useWindowDimensions();
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

  /** Re-announce join + refresh presence when partner/video is slow to connect. */
  const bothJoinedRef = useRef(bothJoined);
  const remoteStreamRef = useRef(remoteStream);
  const statusRef = useRef(status);
  const lastMediaRecoverAtRef = useRef(0);
  bothJoinedRef.current = bothJoined;
  remoteStreamRef.current = remoteStream;
  statusRef.current = status;

  useEffect(() => {
    const delayMs = 20_000;
    const timer = setTimeout(() => {
      if (bothJoinedRef.current && remoteStreamRef.current) return;
      const st = statusRef.current;
      if (st === "failed" || st === "ended" || st === "idle" || st === "preparing") return;
      const now = Date.now();
      if (now - lastMediaRecoverAtRef.current < 25_000) return;
      lastMediaRecoverAtRef.current = now;
      recoverConnection();
      socket?.emit("LESSON_STATE_REQUEST", { sessionId: lessonId });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [lessonId, partnerInSession, recoverConnection, socket]);

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
  const extensionResetRef = useRef(extensionFlow.reset);
  extensionResetRef.current = extensionFlow.reset;

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
  const [escrowMilestone, setEscrowMilestone] =
    useState<EscrowMilestone>("session_active");

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

  const refreshSessionsAfterLessonEnd = useCallback(() => {
    invalidateSessions(queryClient);
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.lookup(lessonId) });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.sessions.joinReadiness(lessonId),
    });
  }, [queryClient, lessonId]);

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
  const annotationTool = useMeetingAnnotationStore((s) => s.tool);
  const annotationColor = useMeetingAnnotationStore((s) => s.color);
  const annotationArmed = useMeetingAnnotationStore((s) => s.armed);
  const annotationToolbarOpen = useMeetingAnnotationStore((s) => s.toolbarOpen);
  const setAnnotationTool = useMeetingAnnotationStore((s) => s.setTool);
  const setAnnotationColor = useMeetingAnnotationStore((s) => s.setColor);
  const setAnnotationArmed = useMeetingAnnotationStore((s) => s.setArmed);
  const setAnnotationToolbarOpen = useMeetingAnnotationStore((s) => s.setToolbarOpen);
  const resetMeetingAnnotation = useMeetingAnnotationStore((s) => s.reset);

  const [measuredActionBarHeight, setMeasuredActionBarHeight] =
    useState(ACTION_BAR_HEIGHT);
  const [measuredAnnotationToolbarHeight, setMeasuredAnnotationToolbarHeight] =
    useState(ANNOTATION_TOOLBAR_HEIGHT);
  const [lockedAnnotPane, setLockedAnnotPane] = useState<0 | 1 | null>(null);

  const hasClipStage =
    clipPaneUrisEarly.length > 0 &&
    (clipSync.selectedClips.length > 0 || Boolean(clipSync.activeClipId));
  const dualClipEarly = clipPaneUrisEarly.length >= 2;
  const lockedDualClipEarly = dualClipEarly && clipSync.lockMode;
  const chrome = useMeetingChromeInsets({
    inClipMode: hasClipStage,
    inlineClipControls: hasClipStage,
    annotationToolbarOpen: isTrainer && annotationToolbarOpen,
    annotationToolbarHeight: measuredAnnotationToolbarHeight,
    dualInlineClipControls: dualClipEarly && hasClipStage && !lockedDualClipEarly,
    actionBarHeight: measuredActionBarHeight,
  });

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

  const { applyRemoteTiles, hideTile, restoreTile, updatePosition, isTileHidden } =
    pipLayout;
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

  const remoteTilesSnapshotRef = useRef("");
  useEffect(() => {
    if (isTrainer) return;
    const snap = JSON.stringify(meetingLayout.tiles);
    if (snap === remoteTilesSnapshotRef.current) return;
    remoteTilesSnapshotRef.current = snap;

    applyRemoteTiles(meetingLayout.tiles);
  }, [isTrainer, meetingLayout.tiles, applyRemoteTiles]);

  const burnInHostRef = useRef<AnnotationBurnInHostHandle>(null);
  const liveCaptureRef = useRef<View>(null);

  const drawingSync = useDrawingSync({
    socket,
    userInfo: { from_user: myId, to_user: peerId },
    sessionId: lessonId,
    isTrainer,
    drawingEmitMinMs: networkTierConfig.drawingEmitMinMs,
  });

  // Track latest camera state in a ref so the socket-replay closure stays current.
  const cameraEnabledRef = useRef(cameraEnabled);
  useEffect(() => { cameraEnabledRef.current = cameraEnabled; }, [cameraEnabled]);

  useEffect(() => {
    if (!socket) return;

    const replayTrainerState = () => {
      if (!isTrainer) return;
      clipSync.replayClipSocketState();
      meetingLayout.replayLayoutState();
      drawingSync.replaySocketState();
      // Re-broadcast camera state so the trainee doesn't see a stale
      // "camera on" tile after WebRTC ICE reconnect.
      socket.emit(CALL_EVENTS.STOP_FEED, {
        feedStatus: cameraEnabledRef.current,
        userInfo: { from_user: myId, to_user: peerId, sessionId: lessonId },
      });
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

  const burnInProjectionRef = useRef<AnnotationProjectionOptions>({});

  const applyAnnotationBurnIn = useCallback(
    async (localUri: string) => {
      const strokes = drawingSync.getCaptureStrokes();
      if (!strokes.length) return null;
      const canvasSize = drawingSync.getLastCanvasSize();
      return (
        burnInHostRef.current?.composite(
          localUri,
          strokes,
          canvasSize,
          burnInProjectionRef.current
        ) ?? null
      );
    },
    [drawingSync]
  );

  const pendingScreenshotPreviewRef = useRef<string | null>(null);
  const screenshotLiveStreamRef = useRef<MediaStream | null>(remoteStream);
  const [screenshotLiveStream, setScreenshotLiveStream] = useState<MediaStream | null>(
    remoteStream
  );

  const captureLiveFrameForScreenshot = useCallback(
    () => captureLiveVideoFrame(liveCaptureRef),
    []
  );

  const isLiveVideoReadyForScreenshot = useCallback(
    () => isMediaStreamVideoReady(screenshotLiveStreamRef.current),
    []
  );

  const screenshot = useMeetingScreenshot({
    sessionId: lessonId,
    trainerId: isTrainer ? myId : peerId,
    traineeId: isTrainer ? peerId : myId,
    isTrainer,
    applyAnnotationBurnIn,
    captureLiveFrame: captureLiveFrameForScreenshot,
    isLiveVideoReady: isLiveVideoReadyForScreenshot,
    onUploadRestart: () => setPendingScreenshotKey(null),
    onCaptured: ({ localUri }) => {
      pendingScreenshotPreviewRef.current = localUri;
      setPendingScreenshotPreviewUri(localUri);
      setPendingScreenshotKey(null);
      setScreenshotDetailsOpen(true);
      pushLocalToast({
        title: "Screenshot captured",
        description: "Add a description to save it to the game plan.",
        type: NOTIFICATION_TYPES.DEFAULT,
      });
    },
    onUploadReady: (imageKey) => {
      setPendingScreenshotKey(imageKey);
    },
    onUploadFailed: (message) => {
      const queuedUri = pendingScreenshotPreviewRef.current;
      if (queuedUri) {
        void enqueueScreenshotUpload({
          localUri: queuedUri,
          sessionId: lessonId,
          trainerId: myId,
          traineeId: peerId,
        });
      }
      pushLocalToast({
        title: "Upload queued",
        description: __DEV__
          ? `${message} — saved locally; we'll retry when you're back online.`
          : "Saved locally — we'll retry when you're back online.",
        type: NOTIFICATION_TYPES.DEFAULT,
      });
    },
  });

  useScreenshotUploadRetry(isTrainer, {
    sessionId: lessonId,
    onUploaded: (imageKey) => {
      setPendingScreenshotKey(imageKey);
      void screenshot.refreshScreenshots();
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
  const [awaitingPartnerEnd, setAwaitingPartnerEnd] = useState(false);
  const [gamePlanOpen, setGamePlanOpen] = useState(false);
  const [gamePlanBanner, setGamePlanBanner] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);
  const [screenshotSheetOpen, setScreenshotSheetOpen] = useState(false);
  const [screenshotDetailsOpen, setScreenshotDetailsOpen] = useState(false);
  const [pendingScreenshotKey, setPendingScreenshotKey] = useState<string | null>(null);
  const [pendingScreenshotPreviewUri, setPendingScreenshotPreviewUri] = useState<
    string | null
  >(null);
  const [clipDurations, setClipDurations] = useState<[number, number]>([0, 0]);
  const [clipProgresses, setClipProgresses] = useState<[number, number]>([0, 0]);
  const [drawingOverlayKey, setDrawingOverlayKey] = useState(0);
  const [clipNaturalSize, setClipNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const clipFrameOffsetRef = useRef({ x: 0, y: 0 });
  const paneOffsetRef = useRef<Partial<Record<0 | 1, { x: number; y: number }>>>({});
  const clipLocalRectRef = useRef<Partial<Record<0 | 1, ContentRect>>>({});
  const [measuredAnnotationRect, setMeasuredAnnotationRect] = useState<ContentRect | null>(
    null
  );
  const [localVideoAspect, setLocalVideoAspect] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [remoteVideoAspect, setRemoteVideoAspect] = useState<{
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => () => resetMeetingAnnotation(), [resetMeetingAnnotation]);

  /** Collapse camera strip while drawing so PIPs do not cover the clip stage. */
  useEffect(() => {
    if (!isTrainer || !annotationArmed) return;
    meetingLayout.setCameraStripCollapsed(true);
  }, [isTrainer, annotationArmed, meetingLayout.setCameraStripCollapsed]);
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

  const preloadBookingClips = clipSync.preloadBookingClips;
  useEffect(() => {
    if (!session) return;
    const bookingClips = playableBookingClips(session, joinReadiness?.clips);
    if (bookingClips.length > 0) {
      preloadBookingClips(bookingClips, { emitSocket: isTrainer });
    }
  }, [session, session?.trainee_clips, joinReadiness?.clips, preloadBookingClips, isTrainer]);

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

  const handleTakeScreenshot = useCallback(() => {
    void screenshot.takeScreenshot();
  }, [screenshot]);

  const clipScreenshotLabels = useMemo((): [string, string] => {
    const labels = clipSync.selectedClips.slice(0, 2).map((c, i) => {
      const t = String(c?.title ?? c?.name ?? "").trim();
      return t || `Clip ${i + 1}`;
    });
    return [labels[0] ?? "Clip 1", labels[1] ?? "Clip 2"];
  }, [clipSync.selectedClips]);

  const lockedDualClip = dualClip && clipSync.lockMode;
  const clipFocusIndex = lockedDualClip ? null : clipSync.clipFocusIndex;

  const lockedProgress = useMemo(() => {
    const [p0, p1] = clipProgresses;
    const [d0, d1] = clipDurations;
    if (d0 > 0.5 && d1 > 0.5 && Math.abs(d0 - d1) > 0.5) {
      return Math.min(p0, p1);
    }
    return Math.max(p0, p1);
  }, [clipProgresses, clipDurations]);
  const lockedDuration = Math.max(clipDurations[0], clipDurations[1]);

  const activePaneIndex = useMemo((): 0 | 1 => {
    const idx = clipSync.selectedClips.findIndex(
      (c) => clipIdOf(c) === clipSync.activeClipId
    );
    return idx === 1 ? 1 : 0;
  }, [clipSync.activeClipId, clipSync.selectedClips]);

  /** Pane whose intrinsic size drives annotation UV mapping (focused or active clip). */
  const annotationSourcePane = useMemo((): 0 | 1 => {
    if (lockedDualClip && lockedAnnotPane != null) return lockedAnnotPane;
    if (clipFocusIndex === 0 || clipFocusIndex === 1) return clipFocusIndex;
    return activePaneIndex;
  }, [activePaneIndex, clipFocusIndex, lockedAnnotPane, lockedDualClip]);

  const syncMeasuredAnnotationRect = useCallback((pane: 0 | 1) => {
    const paneOff = paneOffsetRef.current[pane];
    const local = clipLocalRectRef.current[pane];
    if (!local) return;
    const baseX = clipFrameOffsetRef.current.x + (paneOff?.x ?? 0);
    const baseY = clipFrameOffsetRef.current.y + (paneOff?.y ?? 0);
    setMeasuredAnnotationRect({
      x: baseX + local.x,
      y: baseY + local.y,
      width: local.width,
      height: local.height,
    });
  }, []);

  const handleAnnotationPaneLayout = useCallback(
    (paneIndex: 0 | 1, layout: { x: number; y: number; width: number; height: number }) => {
      paneOffsetRef.current[paneIndex] = { x: layout.x, y: layout.y };
      if (paneIndex === annotationSourcePane) {
        syncMeasuredAnnotationRect(paneIndex);
      }
    },
    [annotationSourcePane, syncMeasuredAnnotationRect]
  );

  const clipSelectionKey = useMemo(
    () => clipSync.selectedClips.map((c) => clipIdOf(c)).join("|"),
    [clipSync.selectedClips]
  );

  /** Single shared clip fills the stage (trainer pick or trainee share). */
  useEffect(() => {
    if (!hasClipStage || clipPaneUris.length !== 1) return;
    if (!clipSync.clipFullscreen && clipSync.clipFocusIndex == null) {
      clipSync.toggleClipFullscreen();
    }
  }, [clipSelectionKey, clipPaneUris.length, hasClipStage, clipSync]);

  /** Dual clips use split view — exit full-stage clip mode. */
  useEffect(() => {
    if (!hasClipStage || clipPaneUris.length < 2) return;
    if (clipSync.clipFocusIndex != null) return;
    if (clipSync.clipFullscreen) {
      clipSync.toggleClipFullscreen();
    }
  }, [clipPaneUris.length, hasClipStage, clipSync]);

  const autoClipFocusForAnnotationRef = useRef(false);
  useEffect(() => {
    if (!isTrainer || !dualClip) {
      autoClipFocusForAnnotationRef.current = false;
      setLockedAnnotPane(null);
      return;
    }
    if (annotationToolbarOpen) {
      if (lockedDualClip) {
        setLockedAnnotPane((prev) => prev ?? activePaneIndex);
        return;
      }
      if (clipSync.clipFocusIndex == null) {
        autoClipFocusForAnnotationRef.current = true;
        clipSync.setClipFocus(annotationSourcePane);
      }
      return;
    }
    setLockedAnnotPane(null);
    if (autoClipFocusForAnnotationRef.current) {
      autoClipFocusForAnnotationRef.current = false;
      clipSync.setClipFocus(null);
    }
  }, [
    activePaneIndex,
    annotationSourcePane,
    annotationToolbarOpen,
    clipSync,
    dualClip,
    isTrainer,
    lockedDualClip,
  ]);

  const lockedAnnotating =
    isTrainer && lockedDualClip && annotationToolbarOpen && lockedAnnotPane != null;

  useEffect(() => {
    if (lockedAnnotPane == null) return;
    syncMeasuredAnnotationRect(lockedAnnotPane);
  }, [lockedAnnotPane, syncMeasuredAnnotationRect]);

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
      isPlaying: clipSync.lockMode
        ? clipSync.isPlaying && !clipEndedRef.current[paneIndex]
        : clipSync.isClipPlaying(clipId),
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
      onNaturalSize:
        paneIndex === annotationSourcePane
          ? (w: number, h: number) => {
              if (w > 0 && h > 0) setClipNaturalSize({ width: w, height: h });
            }
          : undefined,
      onAnnotationVideoRect: (rect: ContentRect) => {
        clipLocalRectRef.current[paneIndex] = rect;
        if (paneIndex === annotationSourcePane) {
          syncMeasuredAnnotationRect(paneIndex);
        }
      },
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
    (paneIndex: 0 | 1, sec: number, commit = true) => {
      if (clipSync.lockMode && clipSync.selectedClips.length >= 2) {
        clipEndedRef.current = [false, false];
        clipProgressRefs.current = [sec, sec];
        setClipProgresses([sec, sec]);
        clipSync.seek(sec, { forceEmit: commit });
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
      clipSync.seek(sec, { forceEmit: commit, videoId: id ?? undefined });
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
          handleTakeScreenshot();
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
    [handleTakeScreenshot, handleToggleLock, instantRecording, openAudioOutputPicker, screenshot]
  );

  const continueAfterRecap = useCallback(async () => {
    /** Only open the PDF game-plan editor when the trainer captured screenshots during the lesson. */
    try {
      const res = await fetchSessionReport({
        sessions: lessonId,
        trainer: myId,
        trainee: peerId,
      });
      const data = res?.data ?? res;
      const items = parseReportScreenshotItems(data?.reportData);
      if (items.length > 0) {
        setGamePlanOpen(true);
        return;
      }
    } catch {
      /* fall through to ratings */
    }
    setRatingsOpen(true);
  }, [lessonId, myId, peerId]);

  /**
   * Safety valve: if the trainer skips/dismisses the game plan without the
   * normal onClose path (e.g. back button, modal error), we still ensure
   * ratings open. Called as fallback from RecapSheet directly when the
   * trainer taps "Skip game plan".
   */
  const openTrainerRatingsDirectly = useCallback(() => {
    setGamePlanOpen(false);
    setRatingsOpen(true);
  }, []);

  const openPostCallFlow = useCallback(async () => {
    if (postCallFlowStartedRef.current) return;
    setAwaitingPartnerEnd(false);
    postCallFlowStartedRef.current = true;
    refreshSessionsAfterLessonEnd();
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
  }, [isTrainer, lessonId, onPostCallFlowStart, openHandoff, refreshSessionsAfterLessonEnd]);

  const departure = useSessionDeparture({
    socket,
    sessionId: lessonId,
    myUserId: myId,
    isTrainer,
    onPartnerAcceptedEnd: () => {
      setTraineeExtendOpen(false);
      extensionResetRef.current?.();
      void openPostCallFlow();
    },
    onStayedActive: () => {
      reportOpsEvent({
        event_type: "SESSION_DEPARTURE_STAYED",
        category: "call",
        session_id: lessonId,
        title: "Partner stayed after departure",
      });
      pushLocalToast({
        title: "Session still active",
        description: isTrainer
          ? "Timer paused. Rejoin from your dashboard if your schedule allows."
          : "Timer paused. Waiting for your coach to rejoin…",
        type: NOTIFICATION_TYPES.TRANSCATIONAL,
      });
    },
  });

  const [rejoinBlockedDismissed, setRejoinBlockedDismissed] = useState(false);

  const liveLessonUx = useLiveLessonUxState({
    cameraRevoked: inCallPerms.cameraRevoked,
    partnerReconnecting: presence.partnerReconnecting,
    partnerInSession,
    hasRemoteStream: !!remoteStream,
    partnerDisconnected,
    peerDisplayName,
    isTrainer,
    presence,
    bothJoined,
    networkOnline,
    lessonTimer: {
      status: lessonTimer.status,
      pauseReason: lessonTimer.pauseReason,
      remainingSeconds: lessonTimer.remainingSeconds ?? 0,
    },
    extensionPhase: extensionFlow.state.phase,
    departurePrompt: departure.prompt,
    departureWaitingAfterDecline: departure.waitingAfterDecline,
    departureRejoinSecondsLeft: departure.rejoinSecondsLeft,
    socketReconnectFailed: reconnectFailed,
    joinBlockReason: joinReadiness?.join_block_reason,
    joinCode: joinReadiness?.join_code,
  });

  const meetingStatusBanner = liveLessonUx.statusBanner;
  const timerStatusHint = liveLessonUx.timerHint;

  /** Show ratings after the call ends — initiator leaves via departure API;
   *  partner decides via SessionDepartureModal before post-call flow opens. */
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
            void (async () => {
              onDepartureInitiated?.();
              setAwaitingPartnerEnd(true);
              try {
                await initiateSessionDeparture(lessonId);
                reportOpsEvent({
                  event_type: "SESSION_DEPARTURE_INITIATED",
                  category: "call",
                  session_id: lessonId,
                  title: "User initiated session departure",
                });
              } catch (err: unknown) {
                setAwaitingPartnerEnd(false);
                const msg =
                  err instanceof Error
                    ? err.message
                    : "Could not start session end. Check your connection and try again.";
                pushLocalToast({
                  title: "Couldn't end session",
                  description: msg,
                  type: NOTIFICATION_TYPES.TRANSCATIONAL,
                });
                return;
              }
              endCall();
            })();
          },
        },
      ]
    );
  }, [endCall, lessonId, onDepartureInitiated, pushLocalToast]);

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
  const wasInLiveFocusRef = useRef(false);
  useEffect(() => {
    if (inLiveFocus && !wasInLiveFocusRef.current && clipSync.isPlaying) {
      clipSync.togglePlay(false);
    }
    wasInLiveFocusRef.current = inLiveFocus;
  }, [inLiveFocus, clipSync]);
  useEffect(() => {
    setClipNaturalSize(null);
  }, [activeClipUri, clipSync.activeClipId]);

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

  const defaultLiveLocalPipFallback = useMemo(() => {
    if (!meetingBounds) return { x: 0, y: 0 };
    return defaultPipPosition(
      "local",
      meetingBounds,
      chrome.insets.top,
      chrome.pipSafeBottom
    );
  }, [meetingBounds, chrome.insets.top, chrome.pipSafeBottom]);

  const defaultLiveLocalPipPosition = useMemo(
    () =>
      resolveTilePosition(
        meetingLayout.tiles.local,
        meetingBounds,
        defaultLiveLocalPipFallback
      ),
    [meetingLayout.tiles.local, meetingBounds, defaultLiveLocalPipFallback]
  );

  const defaultLiveLocalPipSize = useMemo(
    () =>
      resolveTileSize(meetingLayout.tiles.local, meetingBounds, {
        w: PIP_WIDTH,
        h: PIP_HEIGHT,
      }),
    [meetingLayout.tiles.local, meetingBounds]
  );

  useEffect(() => {
    if (!isTrainer || !meetingBounds || inLiveFocus || inClipMode) return;
    const tile = meetingLayout.tiles.local;
    if (tile.nx != null && tile.ny != null) return;
    const seeded = defaultLocalPipLayout(
      meetingBounds,
      chrome.insets.top,
      chrome.pipSafeBottom
    );
    meetingLayout.updateTile("local", {
      ...pipPositionPatch(seeded.position, seeded.size),
      hidden: false,
      hiddenEdge: tile.hiddenEdge ?? seeded.hiddenEdge,
    });
  }, [
    isTrainer,
    meetingBounds,
    inLiveFocus,
    inClipMode,
    meetingLayout.tiles.local.nx,
    meetingLayout.tiles.local.ny,
    meetingLayout.tiles.local.hiddenEdge,
    meetingLayout.updateTile,
    pipPositionPatch,
    chrome.insets.top,
    chrome.pipSafeBottom,
  ]);

  const handleDefaultLivePipMove = useCallback(
    (pos: { x: number; y: number }) => {
      if (!isTrainer) return;
      meetingLayout.updateTile(
        "local",
        pipPositionPatch(pos, defaultLiveLocalPipSize)
      );
      updatePosition("local", pos);
    },
    [
      defaultLiveLocalPipSize,
      isTrainer,
      meetingLayout,
      pipPositionPatch,
      updatePosition,
    ]
  );

  const handleDefaultLivePipHide = useCallback(
    (edge: PipEdge, lastPos: { x: number; y: number }) => {
      if (!isTrainer) return;
      meetingLayout.updateTile("local", {
        ...pipPositionPatch(lastPos, defaultLiveLocalPipSize),
        hidden: true,
        hiddenEdge: edge,
      });
      hideTile("local", edge, lastPos);
    },
    [defaultLiveLocalPipSize, hideTile, isTrainer, meetingLayout, pipPositionPatch]
  );

  const handleDefaultLivePipRestore = useCallback(() => {
    if (!isTrainer) return;
    meetingLayout.updateTile("local", { hidden: false });
    restoreTile("local");
  }, [isTrainer, meetingLayout, restoreTile]);

  const clipModeLocalPipFallback = useMemo(() => {
    if (!meetingBounds) return { x: 0, y: 0 };
    return defaultClipModeLocalPipLayout(
      meetingBounds,
      chrome.insets.top,
      chrome.pipSafeBottom
    ).position;
  }, [meetingBounds, chrome.insets.top, chrome.pipSafeBottom]);

  const clipModeRemotePipFallback = useMemo(() => {
    if (!meetingBounds) return { x: 0, y: 0 };
    return defaultClipModeRemotePipLayout(
      meetingBounds,
      chrome.insets.top,
      chrome.pipSafeBottom
    ).position;
  }, [meetingBounds, chrome.insets.top, chrome.pipSafeBottom]);

  const clipModeLocalPipPosition = useMemo(
    () =>
      resolveTilePosition(
        meetingLayout.tiles.local,
        meetingBounds,
        clipModeLocalPipFallback
      ),
    [meetingLayout.tiles.local, meetingBounds, clipModeLocalPipFallback]
  );

  const clipModeRemotePipPosition = useMemo(
    () =>
      resolveTilePosition(
        meetingLayout.tiles.remote,
        meetingBounds,
        clipModeRemotePipFallback
      ),
    [meetingLayout.tiles.remote, meetingBounds, clipModeRemotePipFallback]
  );

  const clipModeLocalPipSize = useMemo(
    () =>
      resolveTileSize(meetingLayout.tiles.local, meetingBounds, CLIP_MODE_PIP),
    [meetingLayout.tiles.local, meetingBounds]
  );

  const clipModeRemotePipSize = useMemo(
    () =>
      resolveTileSize(meetingLayout.tiles.remote, meetingBounds, CLIP_MODE_PIP),
    [meetingLayout.tiles.remote, meetingBounds]
  );

  useEffect(() => {
    if (!isTrainer || !meetingBounds || !inClipMode || inLiveFocus) return;
    const localTile = meetingLayout.tiles.local;
    const remoteTile = meetingLayout.tiles.remote;
    if (localTile.nx == null || localTile.ny == null) {
      const seeded = defaultClipModeLocalPipLayout(
        meetingBounds,
        chrome.insets.top,
        chrome.pipSafeBottom
      );
      meetingLayout.updateTile("local", {
        ...pipPositionPatch(seeded.position, seeded.size),
        hidden: localTile.hidden ?? false,
        hiddenEdge: localTile.hiddenEdge ?? seeded.hiddenEdge,
      });
    }
    if (remoteTile.nx == null || remoteTile.ny == null) {
      const seeded = defaultClipModeRemotePipLayout(
        meetingBounds,
        chrome.insets.top,
        chrome.pipSafeBottom
      );
      meetingLayout.updateTile("remote", {
        ...pipPositionPatch(seeded.position, seeded.size),
        hidden: remoteTile.hidden ?? false,
        hiddenEdge: remoteTile.hiddenEdge ?? seeded.hiddenEdge,
      });
    }
  }, [
    isTrainer,
    meetingBounds,
    inClipMode,
    inLiveFocus,
    meetingLayout.tiles.local.nx,
    meetingLayout.tiles.local.ny,
    meetingLayout.tiles.remote.nx,
    meetingLayout.tiles.remote.ny,
    meetingLayout.tiles.local.hidden,
    meetingLayout.tiles.local.hiddenEdge,
    meetingLayout.tiles.remote.hidden,
    meetingLayout.tiles.remote.hiddenEdge,
    meetingLayout.updateTile,
    pipPositionPatch,
    chrome.insets.top,
    chrome.pipSafeBottom,
  ]);

  const handleClipModePipMove = useCallback(
    (tile: "local" | "remote", pos: { x: number; y: number }) => {
      if (!isTrainer) return;
      const size = tile === "local" ? clipModeLocalPipSize : clipModeRemotePipSize;
      meetingLayout.updateTile(tile, pipPositionPatch(pos, size));
      updatePosition(tile, pos);
    },
    [
      clipModeLocalPipSize,
      clipModeRemotePipSize,
      isTrainer,
      meetingLayout,
      pipPositionPatch,
      updatePosition,
    ]
  );

  const handleClipModePipHide = useCallback(
    (tile: "local" | "remote", edge: PipEdge, lastPos: { x: number; y: number }) => {
      if (!isTrainer) return;
      const size = tile === "local" ? clipModeLocalPipSize : clipModeRemotePipSize;
      meetingLayout.updateTile(tile, {
        ...pipPositionPatch(lastPos, size),
        hidden: true,
        hiddenEdge: edge,
      });
      hideTile(tile, edge, lastPos);
    },
    [clipModeLocalPipSize, clipModeRemotePipSize, hideTile, isTrainer, meetingLayout, pipPositionPatch]
  );

  const handleClipModePipRestore = useCallback(
    (tile: "local" | "remote") => {
      if (!isTrainer) return;
      meetingLayout.updateTile(tile, { hidden: false });
      restoreTile(tile);
    },
    [isTrainer, meetingLayout, restoreTile]
  );

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

  const handleAnnotationToolbarDrawingToggle = useCallback(() => {
    if (annotationArmed) {
      setAnnotationArmed(false);
      setAnnotationToolbarOpen(false);
      drawingSync.setTrainerDrawingEnabled(false);
      setDrawingOverlayKey((k) => k + 1);
      return;
    }
    setAnnotationArmed(true);
    drawingSync.setTrainerDrawingEnabled(true);
  }, [annotationArmed, drawingSync]);

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

  const annotationContentAspect = useMemo(() => {
    if (hasClipStage && clipNaturalSize && clipNaturalSize.width > 0) {
      return clipNaturalSize;
    }
    if (inLiveFocus) {
      const aspect = focusedIsLocal ? localVideoAspect : remoteVideoAspect;
      if (aspect && aspect.width > 0 && aspect.height > 0) return aspect;
    }
    if (isTrainer && remoteVideoAspect) return remoteVideoAspect;
    if (!isTrainer && localVideoAspect) return localVideoAspect;
    return remoteVideoAspect ?? localVideoAspect ?? { width: 16, height: 9 };
  }, [
    clipNaturalSize,
    focusedIsLocal,
    hasClipStage,
    inLiveFocus,
    isTrainer,
    localVideoAspect,
    remoteVideoAspect,
  ]);

  const annotationClipLayout = useMemo((): ClipAnnotationLayout | null => {
    if (!hasClipStage) return null;
    const trainerControls = isTrainer;
    if (!dualClip) return { mode: "single", trainerControls };
    if (lockedDualClip) {
      return { mode: "dual-locked", paneIndex: annotationSourcePane, trainerControls };
    }
    if (clipFocusIndex != null) {
      return {
        mode: "dual-unlocked",
        paneIndex: clipFocusIndex,
        trainerControls,
        focused: true,
      };
    }
    return { mode: "dual-unlocked", paneIndex: annotationSourcePane, trainerControls };
  }, [
    annotationSourcePane,
    clipFocusIndex,
    dualClip,
    hasClipStage,
    isTrainer,
    lockedDualClip,
  ]);

  const annotationZoomPan = useMemo(() => {
    if (!hasClipStage) return null;
    const clip = clipSync.selectedClips[annotationSourcePane];
    const clipId = clip ? clipIdOf(clip) : null;
    if (!clipId) return null;
    const zp = clipSync.zoomPanByVideoId[String(clipId)];
    return zp
      ? { zoom: zp.zoom, pan: zp.pan }
      : { zoom: 1, pan: { x: 0, y: 0 } };
  }, [annotationSourcePane, clipSync.selectedClips, clipSync.zoomPanByVideoId, hasClipStage]);

  const annotationContentFit = hasClipStage ? ("contain" as const) : ("cover" as const);

  useEffect(() => {
    const canvasSize = drawingSync.getLastCanvasSize();
    burnInProjectionRef.current = {
      contentAspect: annotationContentAspect,
      contentFit: annotationContentFit,
      measuredContentRect: measuredAnnotationRect,
      zoomPan: annotationZoomPan,
      contentInsets:
        measuredAnnotationRect == null && annotationClipLayout
          ? resolveClipContentInsets(canvasSize, annotationClipLayout)
          : undefined,
    };
  }, [
    annotationClipLayout,
    annotationContentAspect,
    annotationContentFit,
    annotationZoomPan,
    drawingSync,
    measuredAnnotationRect,
  ]);

  useEffect(() => {
    const track = localStream?.getVideoTracks?.()?.[0];
    if (!track) {
      setLocalVideoAspect(null);
      return;
    }
    const settings = track.getSettings?.() as { width?: number; height?: number } | undefined;
    if (settings?.width && settings?.height) {
      setLocalVideoAspect({ width: settings.width, height: settings.height });
    }
  }, [localStream]);

  useEffect(() => {
    const track = remoteStream?.getVideoTracks?.()?.[0];
    if (!track) {
      setRemoteVideoAspect(null);
      return;
    }
    const settings = track.getSettings?.() as { width?: number; height?: number } | undefined;
    if (settings?.width && settings?.height) {
      setRemoteVideoAspect({ width: settings.width, height: settings.height });
    }
  }, [remoteStream]);

  const annotationTargetUserId = useMemo(() => {
    if (inLiveFocus) {
      return focusedIsLocal ? myId : peerId;
    }
    return peerId;
  }, [focusedIsLocal, inLiveFocus, myId, peerId]);

  useEffect(() => {
    const stream = inLiveFocus
      ? focusedIsLocal
        ? localStream
        : remoteStream
      : isTrainer
        ? remoteStream
        : localStream;
    screenshotLiveStreamRef.current = stream;
    setScreenshotLiveStream(stream);
  }, [inLiveFocus, focusedIsLocal, isTrainer, localStream, remoteStream]);

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
        setEscrowMilestone(
          key === "five" ? "ending_soon_five" : "ending_soon_two"
        );
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

  useEffect(() => {
    if (isTrainer) return;
    if (
      lessonTimer.status === "ended" ||
      awaitingPartnerEnd ||
      handoffOpen ||
      ratingsOpen ||
      peerEndedCall
    ) {
      setEscrowMilestone("early_end");
    }
  }, [
    isTrainer,
    lessonTimer.status,
    awaitingPartnerEnd,
    handoffOpen,
    ratingsOpen,
    peerEndedCall,
  ]);

  /** Reset the "already shown" guards whenever the timer is extended so the
   *  next 5/2-min crossing re-opens the modal for the trainee. */
  useEffect(() => {
    if (!socket) return;
    const onExtended = (data: any) => {
      if (!data || String(data.sessionId) !== String(lessonId)) return;
      seenWarningsRef.current = new Set();
      setEscrowMilestone("session_active");
    };
    socket.on("LESSON_TIMER_EXTENDED", onExtended);
    return () => {
      socket.off("LESSON_TIMER_EXTENDED", onExtended);
    };
  }, [socket, lessonId]);

  /** Close extension UI and surface ratings once when the lesson ends. */
  const endedNotifiedRef = useRef(false);
  const endedCleanupDoneRef = useRef(false);
  useEffect(() => {
    if (lessonTimer.status !== "ended") {
      endedNotifiedRef.current = false;
      endedCleanupDoneRef.current = false;
      return;
    }
    if (!endedCleanupDoneRef.current) {
      endedCleanupDoneRef.current = true;
      setTraineeExtendOpen(false);
      setActiveWarning(null);
      extensionResetRef.current();
    }
    if (endedNotifiedRef.current) return;
    endedNotifiedRef.current = true;
    void (async () => {
      const skipToast = postCallFlowStartedRef.current;
      if (!skipToast) {
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
      }
      void openPostCallFlow();
    })();
  }, [lessonTimer.status, pushLocalToast, lessonId, openPostCallFlow]);

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
    const onWarning = (data: {
      sessionId?: string;
      kind?: string;
      escrow_milestone?: EscrowMilestone;
    }) => {
      if (String(data?.sessionId) !== String(lessonId)) return;
      const kind = data?.kind;
      const fromPayload = data?.escrow_milestone;
      if (
        fromPayload === "ending_soon_five" ||
        fromPayload === "ending_soon_two"
      ) {
        setEscrowMilestone(fromPayload);
      } else {
        const derived = escrowMilestoneFromTimerWarning(kind);
        if (derived) setEscrowMilestone(derived);
      }
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
          <ActivityIndicator size="small" color="#fff" />
        </View>
      ) : null}

      <ScreenshotCompositeHost
        frameUris={screenshot.compositeFrameUris}
        captureRef={screenshot.compositeHostRef}
        onLayout={() => {}}
        onFramesReady={screenshot.onCompositeFramesReady}
      />
      {isTrainer ? <AnnotationBurnInHost ref={burnInHostRef} /> : null}
      {isTrainer ? (
        <LiveVideoCaptureHost stream={screenshotLiveStream} captureRef={liveCaptureRef} />
      ) : null}

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
          <View style={styles.traineeClipSyncRow} pointerEvents="none">
            <View style={styles.traineeClipSyncTrack}>
              <View
                style={[
                  styles.traineeClipSyncFill,
                  {
                    width: `${Math.min(
                      100,
                      lockedDualClip
                        ? lockedDuration > 0
                          ? (lockedProgress / lockedDuration) * 100
                          : 0
                        : clipDurations[activePaneIndex] > 0
                          ? (clipProgresses[activePaneIndex] / clipDurations[activePaneIndex]) *
                            100
                          : 0
                    )}%`,
                  },
                ]}
              />
            </View>
          </View>
        ) : null}
        {isTrainer && annotationArmed && !annotationToolbarOpen && !hasClipStage ? (
          <View style={[styles.coachChipRow, styles.coachChipRowDraw]} pointerEvents="none">
            <MeetingCoachChip icon="brush-outline" label="Drawing on" tone="danger" />
          </View>
        ) : null}
        <View
          ref={screenshot.captureTargetRef}
          collapsable={false}
          style={styles.captureSurface}
        >
        {inLiveFocus ? (
          <View style={styles.liveStage}>
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
            style={[
              styles.clipFrame,
              dualClip && styles.clipFrameDual,
            ]}
            onLayout={(e) => {
              const { x, y } = e.nativeEvent.layout;
              clipFrameOffsetRef.current = { x, y };
              syncMeasuredAnnotationRect(annotationSourcePane);
            }}
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
                onSeek={(sec, commit) => handleClipSeek(0, sec, commit)}
                onPaneLayout={handleAnnotationPaneLayout}
                capturing={screenshot.capturing}
                focusPaneIndex={null}
                hideTimeline={false}
                paneLabels={clipScreenshotLabels}
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
                onSeek={(paneIndex, sec, commit) => handleClipSeek(paneIndex, sec, commit)}
                clipFocusIndex={clipFocusIndex}
                onToggleExpand={(paneIndex) =>
                  clipSync.setClipFocus(
                    clipFocusIndex === paneIndex ? null : paneIndex
                  )
                }
                onPaneLayout={handleAnnotationPaneLayout}
                capturing={screenshot.capturing}
              />
            ) : (
              <View
                style={styles.singleClip}
                onLayout={(e) => {
                  const { x, y } = e.nativeEvent.layout;
                  paneOffsetRef.current[0] = { x, y };
                  syncMeasuredAnnotationRect(0);
                }}
              >
                {(() => {
                  const singlePane = makeClipPlayerProps(0);
                  return (
                    <>
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
                      {isTrainer && !screenshot.capturing ? (
                        <View style={styles.singleClipControlsDock}>
                          <ClipPlaybackControls
                            variant="inline"
                            size="default"
                            onLightBackground
                            isPlaying={clipSync.isClipPlaying(
                              clipSync.selectedClips[0]
                                ? clipIdOf(clipSync.selectedClips[0])
                                : null
                            )}
                            onTogglePlay={handleSingleClipTogglePlay}
                            progressSeconds={clipProgresses[0]}
                            durationSeconds={clipDurations[0]}
                            onSeek={(sec, commit) => handleClipSeek(0, sec, commit)}
                            disabled={!activeClipUri}
                          />
                        </View>
                      ) : null}
                    </>
                  );
                })()}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.liveStage}>
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
              localStreamOffHint={localStreamOffHint}
              localLabel="You"
              remoteLabel={peerDisplayName}
              bounds={meetingBounds}
              safeTop={chrome.insets.top}
              pipReservedBottom={chrome.pipSafeBottom}
              localPipPosition={defaultLiveLocalPipPosition}
              localPipSize={defaultLiveLocalPipSize}
              localPipHidden={
                meetingLayout.tiles.local.hidden || isTileHidden("local")
              }
              localPipHiddenEdge={meetingLayout.tiles.local.hiddenEdge ?? "right"}
              onLocalPipPositionChange={handleDefaultLivePipMove}
              onLocalPipHide={handleDefaultLivePipHide}
              onLocalPipRestore={handleDefaultLivePipRestore}
              pipDragDisabled={!isTrainer}
              onSelectLocal={
                isTrainer ? () => meetingLayout.focusStream(myId) : undefined
              }
              onSelectRemote={
                isTrainer ? () => meetingLayout.focusStream(peerId) : undefined
              }
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
          contentAspect={annotationContentAspect}
          contentFit={annotationContentFit}
          clipAnnotationLayout={annotationClipLayout}
          measuredContentRect={measuredAnnotationRect}
          zoomPan={annotationZoomPan}
          annotationTargetUserId={annotationTargetUserId}
          onStrokeComplete={emitAnnotationStroke}
        />
        </View>
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
          escrowMilestone={escrowMilestone}
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
            zIndex={annotationArmed ? 20 : 45}
          />
          {inClipMode && activeClipUri ? (
            <ClipMiniPip
              uri={activeClipUri}
              label="Clips"
              isPlaying={clipSync.isPlaying}
              bottomOffset={chrome.pipSafeBottom}
              onPress={() => {
                if (isTrainer) meetingLayout.clearFocus();
              }}
            />
          ) : null}
        </>
      ) : inClipMode ? (
        /* Bottom-docked video strip — both participants always visible above the action bar */
        <DualVideoStrip
          localUser={
            authUser
              ? {
                  _id: String((authUser as any)._id ?? myId),
                  fullname: (authUser as any).fullname ?? (authUser as any).fullName,
                  profile_picture: (authUser as any).profile_picture,
                }
              : null
          }
          remoteUser={peerUser}
          localStream={localStream}
          remoteStream={remoteStream}
          localStreamOff={!cameraEnabled || !localStream || networkHideLocalPip}
          remoteStreamOff={!remoteStream || remoteCameraOff}
          localStreamOffHint={localStreamOffHint}
          remoteStreamOffHint={remoteStreamOffHint}
          peerDisplayName={peerDisplayName}
          bounds={meetingBounds}
          safeTop={chrome.insets.top}
          pipReservedBottom={chrome.pipSafeBottom}
          collapsedBottom={chrome.cameraStripCollapsedBottom}
          collapsed={meetingLayout.cameraStripCollapsed}
          onCollapsedChange={meetingLayout.setCameraStripCollapsed}
          showCollapseControl={isTrainer}
          pipDragDisabled={!isTrainer}
          localPip={{
            position: clipModeLocalPipPosition,
            size: clipModeLocalPipSize,
            hidden:
              meetingLayout.tiles.local.hidden || isTileHidden("local"),
            hiddenEdge: meetingLayout.tiles.local.hiddenEdge ?? "right",
            onPositionChange: (pos) => handleClipModePipMove("local", pos),
            onHide: (edge, last) => handleClipModePipHide("local", edge, last),
            onRestore: () => handleClipModePipRestore("local"),
          }}
          remotePip={{
            position: clipModeRemotePipPosition,
            size: clipModeRemotePipSize,
            hidden:
              meetingLayout.tiles.remote.hidden || isTileHidden("remote"),
            hiddenEdge: meetingLayout.tiles.remote.hiddenEdge ?? "left",
            onPositionChange: (pos) => handleClipModePipMove("remote", pos),
            onHide: (edge, last) => handleClipModePipHide("remote", edge, last),
            onRestore: () => handleClipModePipRestore("remote"),
          }}
          onTapLocal={isTrainer ? () => meetingLayout.focusStream(myId) : undefined}
          onTapRemote={isTrainer ? () => meetingLayout.focusStream(peerId) : undefined}
          pipZIndex={annotationArmed ? 20 : 46}
        />
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
          isTrainer && partnerInSession ? (
            <MeetingTrainerOverflowMenu
              disabled={screenshot.capturing}
              onSelect={handleTrainerOverflow}
              items={[
                ...(instantRecording.showTrainerRecordingOptIn && isInstant
                  ? [
                      {
                        id: "record" as const,
                        label:
                          lessonTimer.status === "waiting"
                            ? instantRecording.trainerRecordingEnabled
                              ? "Recording enabled"
                              : "Enable recording"
                            : instantRecording.trainerRecordingLive
                              ? "Stop recording"
                              : instantRecording.trainerRecordingEnabled
                                ? "Start recording"
                                : "Enable recording",
                        icon: "radio-button-on" as keyof typeof Ionicons.glyphMap,
                        active:
                          instantRecording.trainerRecordingLive ||
                          instantRecording.trainerRecordingEnabled,
                      },
                    ]
                  : []),
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
                  id: "screenshot",
                  label: "Take screenshot",
                  icon: "camera-outline",
                  disabled: screenshot.capturing,
                },
                {
                  id: "gallery",
                  label: "View captures",
                  icon: "images-outline",
                },
                {
                  id: "audio",
                  label: `Audio · ${audioRoute.routeLabel}`,
                  icon: "volume-high-outline",
                },
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
          onToggleDrawing={handleAnnotationToolbarDrawingToggle}
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
          bottomOffset={chrome.annotationToolbarBottom}
          onLayoutHeight={setMeasuredAnnotationToolbarHeight}
          clipPaneSwitcher={
            lockedDualClip && annotationToolbarOpen
              ? {
                  labels: clipScreenshotLabels,
                  activeIndex: lockedAnnotPane ?? activePaneIndex,
                  onSelect: (idx) => {
                    setLockedAnnotPane(idx);
                    syncMeasuredAnnotationRect(idx);
                  },
                }
              : undefined
          }
        />
      ) : null}

      {/* Bottom chrome */}
      <View
        pointerEvents={reconnectFailed ? "none" : "auto"}
        style={{ opacity: reconnectFailed ? 0.35 : 1 }}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - measuredActionBarHeight) > 2) {
            setMeasuredActionBarHeight(h);
          }
        }}
      >
      <ActionButtons
        isTrainer={isTrainer}
        bottomInset={chrome.bottomChrome}
        audioRouteLabel={audioRoute.routeLabel}
        onToggleAudioRoute={isTrainer ? undefined : audioRoute.toggleAudioRoute}
        onEndCall={confirmExit}
        inClipMode={inClipMode}
        onToggleBigVideo={
          isTrainer &&
          (!inClipMode || (dualClip && (clipFocusIndex != null || clipSync.clipFullscreen)))
            ? handleToggleBigVideo
            : undefined
        }
        bigVideoActive={bigVideoActive}
        onExitClipMode={isTrainer ? exitClipMode : undefined}
        annotationArmed={annotationArmed}
        onToggleDrawing={isTrainer ? handleAnnotationToggle : undefined}
        onScreenshot={isTrainer ? handleTakeScreenshot : undefined}
        screenshotCapturing={screenshot.capturing}
        onOpenClipPicker={() => setPickerOpen(true)}
        showCamerasVisible={isTrainer && inClipMode && meetingLayout.cameraStripCollapsed}
        onShowCameras={() => meetingLayout.setCameraStripCollapsed(false)}
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
            uploadPending={screenshotDetailsOpen && !pendingScreenshotKey}
            previewUri={pendingScreenshotPreviewUri}
            onClose={() => {
              setScreenshotDetailsOpen(false);
              setPendingScreenshotKey(null);
              setPendingScreenshotPreviewUri(null);
              screenshot.disposePendingPreview?.();
            }}
            onPreviewUriChange={(uri) => {
              const prev = pendingScreenshotPreviewRef.current;
              pendingScreenshotPreviewRef.current = uri;
              setPendingScreenshotPreviewUri(uri);
              if (!pendingScreenshotKey) {
                void screenshot.replacePendingUpload(uri);
                if (prev) void replaceQueuedUploadUri(prev, uri);
              }
            }}
            onImageKeyUpdated={(key) => setPendingScreenshotKey(key)}
            onSaved={() => {
              void screenshot.refreshScreenshots();
              setScreenshotSheetOpen(true);
            }}
          />
          <SessionGamePlanModal
            visible={gamePlanOpen}
            sessionId={lessonId}
            trainerId={myId}
            traineeId={peerId}
            traineeName={peerDisplayName}
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

      <SessionDepartureModal
        visible={!!departure.prompt}
        prompt={departure.prompt}
        isTrainer={isTrainer}
        responding={departure.responding}
        autoStayMs={0}
        onStay={() => {
          reportOpsEvent({
            event_type: "SESSION_DEPARTURE_STAYED",
            category: "call",
            session_id: lessonId,
            title: "Partner chose to stay",
          });
          void departure.respond(false);
        }}
        onEndSession={() => {
          reportOpsEvent({
            event_type: "SESSION_DEPARTURE_ENDED",
            category: "call",
            session_id: lessonId,
            title: "Partner chose to end session",
          });
          void departure.respond(true);
        }}
      />

      {awaitingPartnerEnd && !departure.prompt && !postCallFlowStartedRef.current ? (
        <View style={styles.departureWaitOverlay} pointerEvents="none">
          <View style={styles.departureWaitCard}>
            <Text style={styles.departureWaitTitle}>Waiting for your partner</Text>
            <Text style={styles.departureWaitBody}>
              They can choose to end the session or stay until the booked time ends.
            </Text>
          </View>
        </View>
      ) : null}

      <SessionRejoinBlockedModal
        visible={
          liveLessonUx.activeModal === "rejoin_blocked" && !rejoinBlockedDismissed
        }
        reason={liveLessonUx.rejoinBlockedReason ?? "You cannot rejoin this session."}
        onDismiss={() => {
          setRejoinBlockedDismissed(true);
          reportOpsEvent({
            event_type: "REJOIN_BLOCKED",
            category: "call",
            session_id: lessonId,
            title: "Rejoin blocked by schedule conflict",
          });
        }}
      />

      <ExtensionWaitingForCoachModal
        visible={liveLessonUx.showExtensionWaitingCoach}
        onDismiss={() => setTraineeExtendOpen(false)}
        onCancelRequest={() => {
          void extensionFlow.cancelRequest();
          setTraineeExtendOpen(false);
        }}
      />

      {departure.waitingAfterDecline ? (
        <View style={styles.departureWaitBanner} pointerEvents="box-none">
          <Text style={styles.departureWaitTitle}>
            {isTrainer ? "Trainee chose to stay" : "Waiting for coach to rejoin"}
          </Text>
          {departure.rejoinSecondsLeft != null ? (
            <Text style={styles.departureWaitBody}>
              Rejoin window: {Math.floor(departure.rejoinSecondsLeft / 60)}:
              {String(departure.rejoinSecondsLeft % 60).padStart(2, "0")}
            </Text>
          ) : null}
          {departure.showConcernButton ? (
            <Pressable
              style={styles.departureConcernBtn}
              onPress={() => void departure.raiseConcern()}
              disabled={departure.raisingConcern}
            >
              <Text style={styles.departureConcernBtnText}>
                {departure.raisingConcern ? "Submitting…" : "Report concern to support"}
              </Text>
            </Pressable>
          ) : null}
          {departure.status?.concernRaisedAt ? (
            <Text style={styles.departureWaitBody}>Concern submitted to support.</Text>
          ) : null}
        </View>
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
        autoDismissMs={5000}
      />

      <RatingsModal
        visible={ratingsOpen}
        onClose={() => {
          setRatingsOpen(false);
          void openHandoff();
        }}
        onSkip={() => {
          void markSessionRatingShown(lessonId);
          if (!isTrainer && (endedNotifiedRef.current || lessonTimer.status === "ended")) {
            void stashPendingSessionRating(lessonId);
          }
          // onClose fires immediately after onSkip in RatingsModal — it handles
          // setRatingsOpen(false) + openHandoff() for both roles.
        }}
        onSubmitted={() => {
          void markSessionRatingShown(lessonId);
          setRatingsOpen(false);
          void openHandoff();
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
    backgroundColor: meetingTheme.surface,
    borderWidth: 1,
    borderColor: meetingTheme.border,
  },
  captureSurface: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
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
    flexDirection: "column",
  },
  singleClipPlayer: {
    flex: 1,
    position: "relative",
    minHeight: 200,
  },
  singleClipControlsDock: {
    flexShrink: 0,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.10)",
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
  traineeClipSyncRow: {
    position: "absolute",
    top: 8,
    left: 16,
    right: 16,
    zIndex: 12,
  },
  traineeClipSyncTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  traineeClipSyncFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  departureWaitOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 24,
  },
  departureWaitCard: {
    backgroundColor: "#1c1c1e",
    borderRadius: 16,
    padding: 20,
    gap: 8,
    maxWidth: 320,
  },
  departureWaitTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  departureWaitBody: {
    color: "#c7c7cc",
    fontSize: 14,
    lineHeight: 20,
  },
  captureOverlay: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
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
  departureWaitBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 120,
    backgroundColor: "rgba(28,28,30,0.94)",
    borderRadius: 12,
    padding: 14,
    zIndex: 40,
  },
  departureConcernBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#ff3b30",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  departureConcernBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
