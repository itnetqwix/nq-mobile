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
import { fetchMeetingSession, fetchScheduledMeetings } from "../../home/api/homeApi";
import { parseIceServersFromSession } from "../meetingIceServers";
import { getClipPlaybackUrl } from "../../../lib/clipMediaUrl";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { clipIdOf, clipsFromSession, resolveClipPlayback } from "../clipSyncUtils";
import { useDrawingSync } from "../useDrawingSync";
import { useMeetingScreenshot } from "../useMeetingScreenshot";

import { CallProvider, useCall } from "../CallContext";
import { ensureCallPermissions } from "../permissions";
import { useLessonTimer } from "../useLessonTimer";
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
import { ClipPickerModal } from "../components/ClipPickerModal";
import { LockedDualClipStage } from "../components/LockedDualClipStage";
import { ClipPlayer } from "../components/ClipPlayer";
import { ClipPlaybackControls } from "../components/ClipPlaybackControls";
import { DrawingOverlay } from "../components/DrawingOverlay";
import {
  MeetingAnnotationToolbar,
  type AnnotationTool,
} from "../components/MeetingAnnotationToolbar";
import { SessionGamePlanModal } from "../components/SessionGamePlanModal";
import { RatingsModal } from "../components/RatingsModal";
import { MeetingJoinBanner } from "../components/MeetingJoinBanner";
import { meetingTheme } from "../meetingTheme";

type Props = NativeStackScreenProps<RootStackParamList, "Meeting">;

type SessionRow = Record<string, any>;

const NAVY = meetingTheme.navy;

/** Look up the booking record across the React Query caches we already
 *  populate in UpcomingSessionsScreen / HomeScreen. Falls back to a fresh
 *  upcoming+confirmed pull when the user landed here cold. */
function useSessionLookup(lessonId: string) {
  const queryClient = useQueryClient();
  const cached = useMemo<SessionRow | null>(() => {
    const caches = queryClient.getQueriesData<SessionRow[]>({ queryKey: ["sessions"] });
    for (const [, list] of caches) {
      if (!Array.isArray(list)) continue;
      const hit = list.find((s) => String(s?._id) === String(lessonId));
      if (hit) return hit;
    }
    return null;
  }, [queryClient, lessonId]);

  const { data: fetched, isLoading } = useQuery<SessionRow | undefined>({
    queryKey: ["sessionLookup", lessonId],
    enabled: !cached && !!lessonId,
    queryFn: async () => {
      const direct = await fetchMeetingSession(lessonId);
      if (direct) return direct;
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

  const goHome = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  }, [navigation]);

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
      onEnded={goHome}
      onPeerJoined={() => {
        pushLocalToast({
          title: NOTIFICATION_TITLES.peerJoinedCall,
          description: `${peerDisplayName} joined the meeting.`,
          type: NOTIFICATION_TYPES.DEFAULT,
        });
      }}
      onPeerLeft={() => {
        pushLocalToast({
          title: NOTIFICATION_TITLES.peerLeftCall,
          description: `${peerDisplayName} left the lesson.`,
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
  myId,
  peerId,
  peerDisplayName,
}: {
  lessonId: string;
  session: SessionRow | null;
  isTrainer: boolean;
  accountType: string | null;
  onExit: () => void;
  myId: string;
  peerId: string;
  peerDisplayName: string;
}) {
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
    cameraEnabled,
    remoteCameraOff,
    endCall,
    lastError,
  } = useCall();

  /** Signaling-level join (socket) — distinct from WebRTC media connected. */
  const partnerInSession = bothJoined || !!peerJoined;
  const { socket } = useSocket();
  const { pushLocalToast } = useNotifications();

  /** Small client-side buffer (5 s) before the trainer auto-starts the timer —
   *  same as the web. Lets both sides settle their connection. */
  const [timerBufferElapsed, setTimerBufferElapsed] = useState(false);
  useEffect(() => {
    if (!partnerInSession) return;
    const id = setTimeout(() => setTimerBufferElapsed(true), 5000);
    return () => clearTimeout(id);
  }, [partnerInSession]);

  const lessonTimer = useLessonTimer({
    socket,
    sessionId: lessonId,
    bothUsersJoined: partnerInSession,
    timerBufferElapsed,
    accountType,
    session,
  });

  const clipSync = useClipSync({
    socket,
    fromUserId: myId,
    toUserId: peerId,
    sessionId: lessonId,
    isTrainer,
  });

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
    onSaved: () => {
      pushLocalToast({
        title: "Screenshot saved",
        description: "Added to the session game plan.",
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

  const [pickerOpen, setPickerOpen] = useState(false);
  const [ratingsOpen, setRatingsOpen] = useState(false);
  const [gamePlanOpen, setGamePlanOpen] = useState(false);
  const [clipDurations, setClipDurations] = useState<[number, number]>([0, 0]);
  const [clipProgresses, setClipProgresses] = useState<[number, number]>([0, 0]);
  const [drawingOverlayKey, setDrawingOverlayKey] = useState(0);
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>("freehand");
  const [annotationArmed, setAnnotationArmed] = useState(false);
  const [annotationToolbarOpen, setAnnotationToolbarOpen] = useState(false);
  const [joinBanner, setJoinBanner] = useState<string | null>(null);
  const clipProgressRefs = useRef<[number, number]>([0, 0]);
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
    if (!socket) return;
    const onParticipant = (payload: {
      sessionId?: string;
      role?: string;
      status?: string;
    }) => {
      if (String(payload?.sessionId) !== String(lessonId)) return;
      if (payload?.status !== "connected") return;
      const who =
        payload.role === "trainer"
          ? session?.trainer_info?.fullname ?? "Your coach"
          : session?.trainee_info?.fullname ?? "Your trainee";
      const msg = `${who} has joined the session. Please join if you haven't yet.`;
      setJoinBanner(msg);
      pushLocalToast({
        title: NOTIFICATION_TITLES.peerJoinedCall,
        description: msg,
        type: NOTIFICATION_TYPES.TRANSCATIONAL,
        persistInInbox: true,
      });
    };
    socket.on("PARTICIPANT_STATUS_CHANGED", onParticipant);
    return () => {
      socket.off("PARTICIPANT_STATUS_CHANGED", onParticipant);
    };
  }, [socket, lessonId, session, pushLocalToast]);

  useEffect(() => {
    if (!bothJoined) {
      lessonStartedNotifiedRef.current = false;
      return;
    }
    if (lessonStartedNotifiedRef.current) return;
    lessonStartedNotifiedRef.current = true;
    setJoinBanner(null);
    pushLocalToast({
      title: NOTIFICATION_TITLES.sessionStarted,
      description: "Lesson started — you're both in the call.",
      type: NOTIFICATION_TYPES.TRANSCATIONAL,
    });
  }, [bothJoined, pushLocalToast]);

  /** When the trainer selects a clip we receive the clip metadata so we can
   *  compute the playback URL locally. The trainee receives only the id via
   *  socket and looks up the clip object through the same `getClipPlaybackUrl`
   *  helper used elsewhere. */
  const handleClipsPicked = useCallback(
    (clips: any[]) => {
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
    [clipSync]
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
  const lockedDualClip = dualClip && clipSync.lockMode;
  const clipFocusIndex = lockedDualClip ? null : clipSync.clipFocusIndex;

  const lockedProgress = Math.max(clipProgresses[0], clipProgresses[1]);
  const lockedDuration = Math.max(clipDurations[0], clipDurations[1], clipSync.lockPoint);

  const makeClipPlayerProps = (paneIndex: 0 | 1) => {
    const clip = clipSync.selectedClips[paneIndex];
    const clipId = clip ? clipIdOf(clip) : null;
    const seekForPane =
      clipSync.seekHint &&
      (!clipSync.seekHint.videoId ||
        clipSync.seekHint.videoId === clipId ||
        clipSync.lockMode)
        ? Math.floor(clipSync.seekHint.progress * 1000)
        : null;
    return {
      isPlaying: clipSync.isPlaying,
      seekTargetMs: seekForPane,
      onProgressSeconds: (seconds: number) => {
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
    };
  };

  const handleClipTogglePlay = useCallback(
    (paneIndex: 0 | 1) => {
      const clip = clipSync.selectedClips[paneIndex];
      const id = clip ? clipIdOf(clip) : null;
      if (!id) return;
      if (clipSync.lockMode) {
        clipSync.togglePlay();
        return;
      }
      if (clipSync.activeClipId !== id) {
        const { url } = resolveClipPlayback(clip);
        if (url) {
          setActiveClipUri(url);
          clipSync.selectClip(id, url, clip);
        }
      }
      clipSync.togglePlay(undefined, id);
    },
    [clipSync]
  );

  const handleClipSeek = useCallback(
    (paneIndex: 0 | 1, sec: number) => {
      if (clipSync.lockMode && clipSync.selectedClips.length >= 2) {
        clipProgressRefs.current = [sec, sec];
        setClipProgresses([sec, sec]);
        clipSync.seek(sec, { forceEmit: true });
        return;
      }
      clipProgressRefs.current[paneIndex] = sec;
      setClipProgresses((prev) => {
        const next: [number, number] = [...prev];
        next[paneIndex] = sec;
        return next;
      });
      const clip = clipSync.selectedClips[paneIndex];
      const id = clip ? clipIdOf(clip) : null;
      if (id && clipSync.activeClipId !== id) {
        const { url } = resolveClipPlayback(clip);
        if (url) {
          setActiveClipUri(url);
          clipSync.selectClip(id, url, clip);
        }
      }
      clipSync.seek(sec, { forceEmit: true, videoId: id ?? undefined });
    },
    [clipSync]
  );

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

  /** Show ratings after the call ends — `endCall()` will pop us back, so we
   *  wrap that path: open the modal first, then exit on dismiss. */
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
            endCall();
            if (isTrainer) setGamePlanOpen(true);
            else setRatingsOpen(true);
          },
        },
      ]
    );
  }, [endCall, isTrainer]);

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
  const focusedIsLocal = inLiveFocus && String(meetingLayout.focusedStreamId) === String(myId);
  const focusedIsRemote = inLiveFocus && String(meetingLayout.focusedStreamId) === String(peerId);

  const exitClipMode = useCallback(() => {
    setActiveClipUri(null);
    clipSync.selectClip(null);
    setClipDurations([0, 0]);
    setClipProgresses([0, 0]);
  }, [clipSync]);

  /** Surface time-warning toasts as the timer ticks past key thresholds. The
   *  callback is wired into `TimeRemaining` (which already detects the
   *  crossing) so we don't duplicate the math here. */
  const onTimerCrossThreshold = useCallback(
    (key: "five" | "one" | "thirty") => {
      const partner = peerDisplayName;
      if (key === "five") {
        pushLocalToast({
          title: NOTIFICATION_TITLES.fiveMinutesRemaining,
          description: `Only 5 minutes left in your lesson with ${partner}.`,
          type: NOTIFICATION_TYPES.TRANSCATIONAL,
        });
      } else if (key === "one") {
        pushLocalToast({
          title: NOTIFICATION_TITLES.oneMinuteRemaining,
          description: `1 minute remaining. Wrap up gracefully.`,
          type: NOTIFICATION_TYPES.TRANSCATIONAL,
        });
      } else if (key === "thirty") {
        pushLocalToast({
          title: NOTIFICATION_TITLES.oneMinuteRemaining,
          description: `30 seconds remaining.`,
          type: NOTIFICATION_TYPES.TRANSCATIONAL,
        });
      }
    },
    [pushLocalToast, peerDisplayName]
  );

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

      {/* Remote video / clip pane */}
      <View
        ref={screenshot.captureTargetRef}
        collapsable={false}
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
                onTogglePlay={() => clipSync.togglePlay()}
                onSeek={(sec) => handleClipSeek(0, sec)}
                controlsBottomOffset={chrome.clipControlsBottom}
              />
            ) : dualClip ? (
              <View style={styles.dualColumn}>
                {([0, 1] as const).map((paneIndex) => {
                  const uri = clipPaneUris[paneIndex];
                  if (!uri) return null;
                  const focused =
                    clipFocusIndex == null || clipFocusIndex === paneIndex;
                  if (!focused) return null;
                  return (
                    <View
                      key={paneIndex}
                      style={[
                        styles.dualPane,
                        clipFocusIndex != null && styles.dualPaneFocused,
                      ]}
                    >
                      <ClipPlayer uri={uri} {...makeClipPlayerProps(paneIndex)} />
                      {isTrainer ? (
                        <ClipPlaybackControls
                          variant="inline"
                          isPlaying={clipSync.isPlaying}
                          onTogglePlay={() => handleClipTogglePlay(paneIndex)}
                          progressSeconds={clipProgresses[paneIndex]}
                          durationSeconds={clipDurations[paneIndex]}
                          onSeek={(sec) => handleClipSeek(paneIndex, sec)}
                          disabled={!uri}
                          showExpand
                          isExpanded={clipFocusIndex === paneIndex}
                          onToggleExpand={() =>
                            clipSync.setClipFocus(
                              clipFocusIndex === paneIndex ? null : paneIndex
                            )
                          }
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.singleClip}>
                <ClipPlayer uri={activeClipUri} {...makeClipPlayerProps(0)} />
                {isTrainer ? (
                  <ClipPlaybackControls
                    isPlaying={clipSync.isPlaying}
                    onTogglePlay={() => clipSync.togglePlay()}
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
              remoteStrokes={drawingSync.remoteStrokes}
              onStrokeComplete={(points, size) =>
                drawingSync.emitStroke(
                  { points, color: "#ff3b30", width: 4 },
                  size
                )
              }
            />
          </View>
        ) : (
          <View style={styles.liveStage}>
            <View style={styles.livePlaceholder}>
              <Text style={styles.livePlaceholderTitle}>
                {partnerInSession ? "Live lesson" : "Waiting for your partner"}
              </Text>
              <Text style={styles.livePlaceholderSub}>
                {partnerInSession
                  ? "Use the video tiles to view cameras. Clips open from the toolbar below."
                  : `${peerDisplayName} will appear when they join.`}
              </Text>
            </View>
            <DrawingOverlay
              key={`live-${drawingOverlayKey}`}
              enabled={canDraw}
              tool={annotationTool}
              remoteStrokes={drawingSync.remoteStrokes}
              onStrokeComplete={(points, size) =>
                drawingSync.emitStroke(
                  { points, color: "#ff3b30", width: 4 },
                  size
                )
              }
            />
          </View>
        )}
      </View>

      {joinBanner && !partnerInSession ? (
        <MeetingJoinBanner
          message={joinBanner}
          topOffset={chrome.insets.top + 48}
          onDismiss={() => setJoinBanner(null)}
        />
      ) : null}

      {!partnerInSession && !joinBanner ? (
        <MeetingJoinBanner
          message={`Waiting for ${peerDisplayName} to join the session…`}
          topOffset={chrome.insets.top + 48}
        />
      ) : null}

      {partnerInSession && !remoteStream ? (
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
      ) : (
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
            width={localPipSize.w}
            height={localPipSize.h}
            onSizeChange={(w, h) => {
              setLocalPipSize({ w, h });
              meetingLayout.updateTile("local", { w, h });
            }}
            onFocus={isTrainer ? () => meetingLayout.focusStream(myId) : undefined}
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
            width={remotePipSize.w}
            height={remotePipSize.h}
            onSizeChange={(w, h) => {
              setRemotePipSize({ w, h });
              meetingLayout.updateTile("remote", { w, h });
            }}
            onFocus={() => meetingLayout.focusStream(peerId)}
          />
        </>
      )}

      {/* Top chrome */}
      <TimeRemaining
        remainingSeconds={lessonTimer.remainingSeconds}
        isAuthoritative={lessonTimer.isAuthoritative}
        status={lessonTimer.status}
        bothUsersJoined={partnerInSession}
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
                onPress={() => void screenshot.takeScreenshot()}
                label="Screenshot"
                disabled={screenshot.capturing}
              >
                <Ionicons name="camera-outline" size={18} color={meetingTheme.text} />
              </TopToolButton>
            </>
          ) : undefined
        }
      />

      {isTrainer && annotationToolbarOpen ? (
        <MeetingAnnotationToolbar
          tool={annotationTool}
          onToolChange={setAnnotationTool}
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
        onEndCall={confirmExit}
        inClipMode={inClipMode}
        onToggleLayout={
          isTrainer
            ? () => {
                const next =
                  clipSync.layoutMode === "stacked" ? "default" : "stacked";
                clipSync.setLayout(next);
              }
            : undefined
        }
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
      ) : null}

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
    backgroundColor: meetingTheme.videoPlaceholder,
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
});
