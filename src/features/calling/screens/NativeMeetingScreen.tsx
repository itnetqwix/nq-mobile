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
import { clipIdOf, clipsFromSession, resolveClipPlayback } from "../clipSyncUtils";
import { useDrawingSync } from "../useDrawingSync";
import { useMeetingScreenshot } from "../useMeetingScreenshot";
import { fetchSessionReport } from "../meetingReportApi";

import { CallProvider, useCall } from "../CallContext";
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
import { MeetingLiveStage } from "../components/MeetingLiveStage";
import { MeetingMiniPip } from "../components/MeetingMiniPip";
import { ClipMiniPip } from "../components/ClipMiniPip";
import { ActionButtons } from "../components/ActionButtons";
import { TimeRemaining } from "../components/TimeRemaining";
import { PeerJoinedModal } from "../components/PeerJoinedModal";
import { ConnectionQualityPill } from "../components/ConnectionQualityPill";
import { ClipPickerModal } from "../components/ClipPickerModal";
import { LockedDualClipStage } from "../components/LockedDualClipStage";
import { UnlockedDualClipStage } from "../components/UnlockedDualClipStage";
import { ClipPlayer } from "../components/ClipPlayer";
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
import type { ScreenshotCaptureSource } from "../useMeetingScreenshot";
import { RecordingBar } from "../components/RecordingBar";
import { useInstantLessonRecording } from "../useInstantLessonRecording";
import { RatingsModal } from "../components/RatingsModal";
import { MeetingJoinBanner } from "../components/MeetingJoinBanner";
import { SessionRecapSheet } from "../components/SessionRecapSheet";
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
    const caches = queryClient.getQueriesData<SessionRow[]>({ queryKey: queryKeys.sessions.all });
    for (const [, list] of caches) {
      if (!Array.isArray(list)) continue;
      const hit = list.find((s) => String(s?._id) === String(lessonId));
      if (hit) return hit;
    }
    return null;
  }, [queryClient, lessonId]);

  const { data: fetched, isLoading } = useQuery<SessionRow | null>({
    queryKey: queryKeys.sessions.lookup(lessonId),
    enabled: !cached && !!lessonId,
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

  return { session: cached ?? fetched ?? null, isLoading };
}

export function NativeMeetingScreen({ navigation, route }: Props) {
  const { lessonId } = route.params;
  const { accountType, user } = useAuth();
  const { session, isLoading } = useSessionLookup(lessonId);
  const { pushLocalToast } = useNotifications();
  const [permState, setPermState] = useState<
    "checking" | "granted" | "denied"
  >("checking");

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
        <Text style={styles.centerText}>
          We can't find this session. It may have ended.
        </Text>
      </View>
    );
  }

  const peerDisplayName =
    peer?.fullname ?? peer?.fullName ?? "Your partner";

  return (
    <CallProvider
      sessionId={lessonId}
      fromUser={me}
      toUser={peer}
      role={role}
      iceServers={iceServers}
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
    >
      <MeetingSurface
        lessonId={lessonId}
        session={session}
        isTrainer={role === "Trainer"}
        accountType={accountType}
        onExit={goHome}
        onPostCallFlowStart={beginPostCallFlow}
        myId={me._id}
        peerId={peer._id}
        peerDisplayName={peerDisplayName}
      />
    </CallProvider>
  );
}

function MeetingSurface({
  lessonId,
  session,
  isTrainer,
  accountType,
  onExit,
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
  onPostCallFlowStart: () => void;
  myId: string;
  peerId: string;
  peerDisplayName: string;
}) {
  const { user: authUser } = useAuth();
  const audioRoute = useAudioRoute();
  const [activeClipUri, setActiveClipUri] = useState<string | null>(null);
  const chrome = useMeetingChromeInsets({ inClipMode: !!activeClipUri });
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
    endCall,
    lastError,
  } = useCall();

  const { socket } = useSocket();

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
    return null;
  }, [
    presence.partnerLeftKind,
    presence.partnerReconnecting,
    lessonTimer.status,
    lessonTimer.pauseReason,
  ]);

  const clipSync = useClipSync({
    socket,
    fromUserId: myId,
    toUserId: peerId,
    sessionId: lessonId,
    isTrainer,
  });

  useEffect(() => {
    if (!socket || !isTrainer) return;
    const replay = () => clipSync.replayClipSocketState();
    socket.on("connect", replay);
    socket.on("reconnect", replay);
    return () => {
      socket.off("connect", replay);
      socket.off("reconnect", replay);
    };
  }, [socket, isTrainer, clipSync.replayClipSocketState]);

  const meetingLayout = useMeetingLayout({
    socket,
    sessionId: lessonId,
    myId,
    peerId,
    isTrainer,
  });

  useNativeMeetingPip({
    enabled: partnerInSession && !!localStream,
    preferRemote: true,
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
  useEffect(() => {
    if (isTrainer) return;
    applyRemoteTiles(meetingLayout.tiles);
    const lt = meetingLayout.tiles.local;
    const rt = meetingLayout.tiles.remote;
    if (lt.w > 0 && lt.h > 0) setLocalPipSize({ w: lt.w, h: lt.h });
    if (rt.w > 0 && rt.h > 0) setRemotePipSize({ w: rt.w, h: rt.h });
  }, [isTrainer, meetingLayout.tiles, applyRemoteTiles]);

  const drawingSync = useDrawingSync({
    socket,
    userInfo: { from_user: myId, to_user: peerId },
    sessionId: lessonId,
    isTrainer,
  });

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
    isTrainer,
    isInstantLesson: isInstant,
    lessonTimerStatus: lessonTimer.status,
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [ratingsOpen, setRatingsOpen] = useState(false);
  const [gamePlanOpen, setGamePlanOpen] = useState(false);
  const [screenshotSheetOpen, setScreenshotSheetOpen] = useState(false);
  const [screenshotDetailsOpen, setScreenshotDetailsOpen] = useState(false);
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
  const clipProgressRefs = useRef<[number, number]>([0, 0]);
  const clipEndedRef = useRef<[boolean, boolean]>([false, false]);
  const lessonStartedNotifiedRef = useRef(false);

  useEffect(() => {
    if (!session) return;
    const bookingClips = clipsFromSession(session);
    if (bookingClips.length > 0) {
      clipSync.preloadBookingClips(bookingClips);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preload once per session
  }, [session]);

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
      clipSync.emitSelectClips(playable);
    },
    [clipSync, meetingLayout]
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

  const clipPaneUris = useMemo(() => {
    return clipSync.selectedClips
      .slice(0, 2)
      .map((c) => resolveClipPlayback(c).url)
      .filter((u): u is string => !!u);
  }, [clipSync.selectedClips]);

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
    return {
      isPlaying: clipSync.isClipPlaying(clipId),
      seekTargetMs: seekForPane,
      zoom: zoomPan?.zoom,
      pan: zoomPan?.pan,
      panEnabled: isTrainer && !!clipId && (zoomPan?.zoom ?? 1) > 1,
      onPanChange: clipId
        ? (nextPan: { x: number; y: number }, emitSocket?: boolean) => {
            clipSync.setZoomPan(String(clipId), zoomPan?.zoom ?? 1, nextPan, {
              emitSocket: emitSocket !== false,
            });
          }
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
    clipSync.toggleLockMode({
      progresses: clipProgresses,
      durations: clipDurations,
    });
  }, [clipDurations, clipProgresses, clipSync]);

  const [recapSheetOpen, setRecapSheetOpen] = useState(false);
  const continueAfterRecap = useCallback(async () => {
    let hasScreenshots = screenshot.hasCaptures;
    if (!hasScreenshots) {
      try {
        const res = await fetchSessionReport({
          sessions: lessonId,
          trainer: myId,
          trainee: peerId,
        });
        const data = res?.data ?? res;
        const raw = data?.reportData;
        hasScreenshots =
          Array.isArray(raw) &&
          raw.some((x: unknown) =>
            typeof x === "string"
              ? x.length > 0
              : !!(x as { name?: string; imageUrl?: string })?.name ||
                !!(x as { imageUrl?: string })?.imageUrl
          );
      } catch {
        hasScreenshots = false;
      }
    }
    if (hasScreenshots) setGamePlanOpen(true);
    else setRatingsOpen(true);
  }, [lessonId, myId, peerId, screenshot.hasCaptures]);

  const openPostCallFlow = useCallback(async () => {
    onPostCallFlowStart();
    if (!isTrainer) {
      setRatingsOpen(true);
      return;
    }
    /**
     * Trainers see the recap composer FIRST (skippable). Once they send
     * or skip, we fall through to the existing screenshots / ratings
     * post-call flow via `continueAfterRecap`.
     */
    setRecapSheetOpen(true);
  }, [isTrainer, onPostCallFlowStart]);

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

  const inClipMode = !!activeClipUri;
  const inLiveFocus = meetingLayout.focusedStreamId != null;

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
    [pushLocalToast, peerDisplayName]
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

  /** Fire an inbox + toast when the lesson timer hits 0 (status "ended"),
   *  matching the web "Session Ended → Rate your coach" prompt. */
  const endedNotifiedRef = useRef(false);
  useEffect(() => {
    if (lessonTimer.status !== "ended") {
      endedNotifiedRef.current = false;
      return;
    }
    if (endedNotifiedRef.current) return;
    endedNotifiedRef.current = true;
    pushLocalToast({
      title: NOTIFICATION_TITLES.sessionEnded,
      description: "Your lesson has ended. Tap to rate the session.",
      type: NOTIFICATION_TYPES.TRANSCATIONAL,
      bookingInfo: { lessonId },
      persistInInbox: true,
    });
    setRatingsOpen(true);
  }, [lessonTimer.status, pushLocalToast, lessonId]);

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

      {screenshot.capturing ? (
        <View style={styles.captureOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.captureOverlayText}>Capturing…</Text>
        </View>
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
        {inLiveFocus ? (
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
        ) : activeClipUri ? (
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
                      <ClipPlayer uri={activeClipUri} {...singlePane} />
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
            <DrawingOverlay
              key={drawingOverlayKey}
              enabled={canDraw}
              tool={annotationTool}
              color={annotationColor}
              remoteStrokes={drawingSync.remoteStrokes}
              onStrokeComplete={emitAnnotationStroke}
            />
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
              localLabel="You"
              remoteLabel={peerDisplayName}
              onSelectLocal={
                isTrainer ? () => meetingLayout.focusStream(myId) : undefined
              }
              onSelectRemote={() => meetingLayout.focusStream(peerId)}
            />
            <DrawingOverlay
              key={`live-${drawingOverlayKey}`}
              enabled={canDraw}
              tool={annotationTool}
              color={annotationColor}
              remoteStrokes={drawingSync.remoteStrokes}
              onStrokeComplete={emitAnnotationStroke}
            />
          </View>
        )}
      </View>

      {presence.presenceMessage ? (
        <MeetingJoinBanner
          message={presence.presenceMessage}
          variant={presence.presenceVariant}
          topOffset={chrome.insets.top + 48}
        />
      ) : !partnerInSession ? (
        <MeetingJoinBanner
          message={`Waiting for ${peerDisplayName} to join the session…`}
          topOffset={chrome.insets.top + 48}
        />
      ) : null}

      {partnerInSession && !remoteStream && !partnerDisconnected ? (
        <MeetingJoinBanner
          message="Connecting video…"
          variant="info"
          topOffset={chrome.insets.top + 48}
        />
      ) : null}

      {inLiveFocus ? (
        <>
          <MeetingMiniPip
            user={focusedIsLocal ? peerUser : null}
            stream={focusedIsLocal ? remoteStream : localStream}
            isStreamOff={
              focusedIsLocal
                ? !remoteStream || remoteCameraOff
                : !cameraEnabled || !localStream
            }
            muted={!focusedIsLocal}
            label={focusedIsLocal ? peerDisplayName.split(" ")[0] || "Partner" : "You"}
            isLocal={!focusedIsLocal}
            onPress={
              isTrainer
                ? () => meetingLayout.focusStream(focusedIsLocal ? peerId : myId)
                : () => meetingLayout.clearFocus()
            }
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
            muted
            fallbackLabel="You"
            tabLabel="You"
            bounds={pipBounds}
            safeTop={chrome.insets.top}
            safeBottom={chrome.insets.bottom}
            pipReservedBottom={chrome.pipSafeBottom}
            position={pipLayout.pipLayout.local.position}
            isHidden={pipLayout.pipLayout.local.isHidden}
            hiddenEdge={pipLayout.pipLayout.local.hiddenEdge}
            onPositionChange={(pos) => {
              pipLayout.updatePosition("local", pos);
              meetingLayout.updateTile("local", { x: pos.x, y: pos.y });
            }}
            onHide={(edge, last) => {
              pipLayout.hideTile("local", edge, last);
              meetingLayout.updateTile("local", {
                hidden: true,
                hiddenEdge: edge,
                x: last.x,
                y: last.y,
              });
            }}
            onRestore={() => {
              pipLayout.restoreTile("local");
              meetingLayout.updateTile("local", { hidden: false });
            }}
            onExpand={
              isTrainer ? () => meetingLayout.focusStream(myId) : undefined
            }
          />
          <DraggableVideoPip
            tileId="remote"
            user={peerUser}
            stream={remoteStream}
            isStreamOff={!remoteStream || remoteCameraOff}
            tabLabel={peerDisplayName.split(" ")[0] || "Partner"}
            bounds={pipBounds}
            safeTop={chrome.insets.top}
            safeBottom={chrome.insets.bottom}
            pipReservedBottom={chrome.pipSafeBottom}
            position={pipLayout.pipLayout.remote.position}
            isHidden={pipLayout.pipLayout.remote.isHidden}
            hiddenEdge={pipLayout.pipLayout.remote.hiddenEdge}
            onPositionChange={(pos) => {
              pipLayout.updatePosition("remote", pos);
              meetingLayout.updateTile("remote", { x: pos.x, y: pos.y });
            }}
            onHide={(edge, last) => {
              pipLayout.hideTile("remote", edge, last);
              meetingLayout.updateTile("remote", {
                hidden: true,
                hiddenEdge: edge,
                x: last.x,
                y: last.y,
              });
            }}
            onRestore={() => {
              pipLayout.restoreTile("remote");
              meetingLayout.updateTile("remote", { hidden: false });
            }}
            onExpand={() => meetingLayout.focusStream(peerId)}
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

      {isTrainer && isInstant && lessonTimer.status === "waiting" ? (
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
        <ConnectionQualityPill />
        <View style={{ marginTop: 8 }}>
          <TopToolButton
            onPress={openAudioOutputPicker}
            label={`Audio: ${audioRoute.routeLabel}`}
          >
            <Ionicons name="volume-high-outline" size={16} color={meetingTheme.text} />
          </TopToolButton>
        </View>
      </View>

      {/* Top chrome */}
      <TimeRemaining
        remainingSeconds={lessonTimer.remainingSeconds}
        isAuthoritative={lessonTimer.isAuthoritative}
        status={lessonTimer.status}
        bothUsersJoined={bothUsersForTimer}
        statusHint={timerStatusHint}
        showCoachControls={isTrainer && !isInstant}
        variant={isInstant ? "instant" : "scheduled"}
        timerLabel="Timer"
        topInset={chrome.topChrome}
        alignRight
        onStart={lessonTimer.requestStart}
        onPause={lessonTimer.requestPause}
        onResume={lessonTimer.requestResume}
        onCrossThreshold={onTimerCrossThreshold}
        leadingTools={
          isTrainer && inClipMode ? (
            <>
              {clipSync.selectedClips.length === 2 ? (
                <TopToolButton
                  onPress={handleToggleLock}
                  label={clipSync.lockMode ? "Unlock clips" : "Lock clips"}
                  active={clipSync.lockMode}
                >
                  <Ionicons
                    name={clipSync.lockMode ? "lock-closed" : "lock-open-outline"}
                    size={18}
                    color={meetingTheme.text}
                  />
                </TopToolButton>
              ) : null}
              <TopToolButton
                onPress={() => void screenshot.takeScreenshot(buildScreenshotSources())}
                label="Screenshot"
                disabled={screenshot.capturing}
              >
                {screenshot.capturing ? (
                  <ActivityIndicator size="small" color={meetingTheme.text} />
                ) : (
                  <Ionicons name="camera-outline" size={18} color={meetingTheme.text} />
                )}
              </TopToolButton>
              <TopToolButton
                onPress={() => {
                  void screenshot.refreshScreenshots();
                  setScreenshotSheetOpen(true);
                }}
                label="Screenshot gallery"
              >
                <Ionicons name="images-outline" size={18} color={meetingTheme.text} />
              </TopToolButton>
            </>
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
          bottomOffset={chrome.bottomChrome + 96}
        />
      ) : null}

      {/* Bottom chrome */}
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
        onOpenClipPicker={isTrainer ? () => setPickerOpen(true) : undefined}
      />

      {lastError ? (
        <View style={[styles.errorBanner, { top: chrome.insets.top + 8 }]}>
          <Text style={styles.errorText}>{lastError}</Text>
        </View>
      ) : null}

      <PeerJoinedModal />

      <ClipPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onDone={handleClipsPicked}
        traineeId={
          isTrainer ? String(session?.trainee_info?._id ?? "") : undefined
        }
        selectedClipIds={clipSync.selectedClips.map((c) => String(c._id))}
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
          <SessionGamePlanModal
            visible={gamePlanOpen}
            sessionId={lessonId}
            trainerId={myId}
            traineeId={peerId}
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
        visible={activeWarning != null}
        kind={activeWarning ?? "five"}
        canExtend={!isTrainer && activeWarning === "two"}
        onExtend={() => {
          setActiveWarning(null);
          setTraineeExtendOpen(true);
        }}
        onQuickExtendTenMin={
          !isTrainer && activeWarning === "two"
            ? async () => {
                setActiveWarning(null);
                /**
                 * "+10 min · charge wallet" — auto-fire a 10 minute
                 * extension request via the existing flow. The trainee
                 * modal will surface itself with the price + accept-from-
                 * wallet path on top, so the user can confirm with a
                 * single PIN entry instead of crawling the slider.
                 */
                try {
                  await extensionFlow.requestExtension(10);
                  setTraineeExtendOpen(true);
                } catch {
                  setTraineeExtendOpen(true);
                }
              }
            : undefined
        }
        onDismiss={() => setActiveWarning(null)}
      />

      <RatingsModal
        visible={ratingsOpen}
        onClose={() => {
          setRatingsOpen(false);
          onExit();
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
          }}
        />
      ) : null}
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
  },
  errorText: { color: "#fff", fontSize: 13 },
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
});
