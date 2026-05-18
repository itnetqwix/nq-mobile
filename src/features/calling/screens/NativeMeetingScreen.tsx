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
 *        │ TimeRemaining          RecordingBar │   ← top chrome
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
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMeetingChromeInsets } from "../useMeetingChromeInsets";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../../navigation/types";
import { AccountType } from "../../../constants/accountType";
import { useAuth } from "../../auth/context/AuthContext";
import { useSocket } from "../../socket/SocketContext";
import { fetchScheduledMeetings } from "../../home/api/homeApi";
import { getClipPlaybackUrl } from "../../../lib/clipMediaUrl";
import { clipsFromSession, resolveClipPlayback } from "../clipSyncUtils";
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
import { DraggableVideoPip } from "../components/DraggableVideoPip";
import { useVideoPipLayout } from "../useVideoPipLayout";
import { ActionButtons } from "../components/ActionButtons";
import { TimeRemaining } from "../components/TimeRemaining";
import { PeerJoinedModal } from "../components/PeerJoinedModal";
import { ClipPickerModal } from "../components/ClipPickerModal";
import { ClipPlayer } from "../components/ClipPlayer";
import { ClipPlaybackControls } from "../components/ClipPlaybackControls";
import { DrawingOverlay } from "../components/DrawingOverlay";
import { MeetingClipToolbar } from "../components/MeetingClipToolbar";
import { RatingsModal } from "../components/RatingsModal";

type Props = NativeStackScreenProps<RootStackParamList, "Meeting">;

type SessionRow = Record<string, any>;

const NAVY = "#000080";

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

  useEffect(() => {
    let cancelled = false;
    ensureCallPermissions().then((result) => {
      if (cancelled) return;
      setPermState(result.allGranted ? "granted" : "denied");
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
      profile_picture: u.profile_picture,
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
      profile_picture: other.profile_picture,
    };
  }, [session, role]);

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
        <Text style={[styles.centerText, { color: "#f44336" }]}>
          NetQwix needs camera and microphone access to start your lesson.
        </Text>
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
  const chrome = useMeetingChromeInsets();
  const {
    localStream,
    remoteStream,
    bothJoined,
    cameraEnabled,
    remoteCameraOff,
    endCall,
    lastError,
  } = useCall();
  const { socket } = useSocket();
  const { pushLocalToast } = useNotifications();

  /** Small client-side buffer (5 s) before the trainer auto-starts the timer —
   *  same as the web. Lets both sides settle their connection. */
  const [timerBufferElapsed, setTimerBufferElapsed] = useState(false);
  useEffect(() => {
    if (!bothJoined) return;
    const id = setTimeout(() => setTimerBufferElapsed(true), 5000);
    return () => clearTimeout(id);
  }, [bothJoined]);

  const lessonTimer = useLessonTimer({
    socket,
    sessionId: lessonId,
    bothUsersJoined: bothJoined,
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
  });

  const peerUser = session
    ? isTrainer
      ? session.trainee_info
      : session.trainer_info
    : null;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [ratingsOpen, setRatingsOpen] = useState(false);
  const [activeClipUri, setActiveClipUri] = useState<string | null>(null);
  const [clipDuration, setClipDuration] = useState(0);
  const [clipProgress, setClipProgress] = useState(0);
  const [drawingOverlayKey, setDrawingOverlayKey] = useState(0);
  const clipProgressRef = useRef(0);
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
    if (!bothJoined) {
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
  }, [bothJoined, pushLocalToast]);

  /** When the trainer selects a clip we receive the clip metadata so we can
   *  compute the playback URL locally. The trainee receives only the id via
   *  socket and looks up the clip object through the same `getClipPlaybackUrl`
   *  helper used elsewhere. */
  const handleClipPicked = useCallback(
    (clip: any) => {
      const uri = getClipPlaybackUrl(clip);
      if (!uri) {
        Alert.alert("Clip unavailable", "Could not resolve a playback URL for this clip.");
        return;
      }
      setActiveClipUri(uri);
      clipSync.selectClip(String(clip._id), uri, clip);
    },
    [clipSync]
  );

  useEffect(() => {
    if (clipSync.activeClipUrl) {
      setActiveClipUri(clipSync.activeClipUrl);
    } else if (!clipSync.activeClipId) {
      setActiveClipUri(null);
      setClipDuration(0);
      setClipProgress(0);
    }
  }, [clipSync.activeClipId, clipSync.activeClipUrl]);

  const secondaryClipUri = useMemo(() => {
    if (clipSync.selectedClips.length < 2) return null;
    return resolveClipPlayback(clipSync.selectedClips[1]).url;
  }, [clipSync.selectedClips]);

  const dualClip = clipSync.selectedClips.length >= 2 && !!secondaryClipUri;
  const showDualLayout =
    dualClip && (clipSync.lockMode || clipSync.layoutMode === "stacked");

  const clipPlayerProps = {
    isPlaying: clipSync.isPlaying,
    seekTargetMs: clipSync.seekHint
      ? Math.floor(clipSync.seekHint.progress * 1000)
      : null,
    onProgressSeconds: (seconds: number) => {
      clipProgressRef.current = seconds;
      setClipProgress(seconds);
    },
    onDurationSeconds: setClipDuration,
  };

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
            setRatingsOpen(true);
          },
        },
      ]
    );
  }, [endCall]);

  const isInstant = !!session?.is_instant;

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
          { paddingTop: chrome.mainPaneTop },
          clipSync.clipFullscreen && styles.mainPaneFullscreen,
        ]}
      >
        {activeClipUri ? (
          <View
            style={[
              styles.clipFrame,
              showDualLayout && styles.clipFrameDual,
            ]}
          >
            <View style={showDualLayout ? styles.dualRow : styles.singleClip}>
              <View style={showDualLayout ? styles.dualPane : styles.singleClip}>
                <ClipPlayer uri={activeClipUri} {...clipPlayerProps} />
              </View>
              {showDualLayout && secondaryClipUri ? (
                <View style={styles.dualPane}>
                  <ClipPlayer uri={secondaryClipUri} {...clipPlayerProps} />
                </View>
              ) : null}
            </View>
            {isTrainer ? (
              <ClipPlaybackControls
                isPlaying={clipSync.isPlaying}
                onTogglePlay={() => clipSync.togglePlay()}
                progressSeconds={clipProgress}
                durationSeconds={clipDuration}
                onSeek={(sec) => {
                  clipProgressRef.current = sec;
                  setClipProgress(sec);
                  clipSync.seek(sec, { forceEmit: true });
                }}
                disabled={!activeClipUri}
                bottomOffset={chrome.clipControlsBottom}
              />
            ) : null}
            <DrawingOverlay
              key={drawingOverlayKey}
              enabled={isTrainer && drawingSync.drawingEnabled}
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
          <UserBox
            key={(remoteStream as { toURL?: () => string } | null)?.toURL?.() ?? "no-remote"}
            user={
              session
                ? isTrainer
                  ? session.trainee_info
                  : session.trainer_info
                : null
            }
            stream={remoteStream}
            isStreamOff={!remoteStream || remoteCameraOff}
            fallbackLabel="Waiting for your partner…"
          />
        )}
      </View>

      {/* Draggable live camera PIPs */}
      {meetingBounds ? (
        <>
          <DraggableVideoPip
            tileId="local"
            user={null}
            stream={localStream}
            isStreamOff={!cameraEnabled || !localStream}
            muted
            fallbackLabel="You"
            tabLabel="You"
            bounds={meetingBounds}
            safeTop={chrome.insets.top}
            safeBottom={chrome.insets.bottom}
            pipReservedBottom={chrome.pipSafeBottom}
            position={pipLayout.pipLayout.local.position}
            isHidden={pipLayout.pipLayout.local.isHidden}
            hiddenEdge={pipLayout.pipLayout.local.hiddenEdge}
            onPositionChange={(pos) => pipLayout.updatePosition("local", pos)}
            onHide={(edge, last) => pipLayout.hideTile("local", edge, last)}
            onRestore={() => pipLayout.restoreTile("local")}
          />
          <DraggableVideoPip
            tileId="remote"
            user={peerUser}
            stream={remoteStream}
            isStreamOff={!remoteStream || remoteCameraOff}
            tabLabel={peerDisplayName.split(" ")[0] || "Partner"}
            bounds={meetingBounds}
            safeTop={chrome.insets.top}
            safeBottom={chrome.insets.bottom}
            pipReservedBottom={chrome.pipSafeBottom}
            position={pipLayout.pipLayout.remote.position}
            isHidden={pipLayout.pipLayout.remote.isHidden}
            hiddenEdge={pipLayout.pipLayout.remote.hiddenEdge}
            onPositionChange={(pos) => pipLayout.updatePosition("remote", pos)}
            onHide={(edge, last) => pipLayout.hideTile("remote", edge, last)}
            onRestore={() => pipLayout.restoreTile("remote")}
          />
        </>
      ) : null}

      {/* Top chrome */}
      <TimeRemaining
        remainingSeconds={lessonTimer.remainingSeconds}
        isAuthoritative={lessonTimer.isAuthoritative}
        status={lessonTimer.status}
        bothUsersJoined={bothJoined}
        showCoachControls={isTrainer}
        variant={isInstant ? "instant" : "scheduled"}
        timerLabel={isInstant ? "Lesson time" : "Time remaining"}
        topInset={chrome.topChrome}
        onStart={lessonTimer.requestStart}
        onPause={lessonTimer.requestPause}
        onResume={lessonTimer.requestResume}
        onCrossThreshold={onTimerCrossThreshold}
      />

      {isTrainer && activeClipUri ? (
        <MeetingClipToolbar
          hasClip
          dualClip={dualClip}
          layoutMode={clipSync.layoutMode}
          lockMode={clipSync.lockMode}
          drawingEnabled={drawingSync.drawingEnabled}
          onToggleFullscreen={() => clipSync.toggleClipFullscreen()}
          onToggleStacked={() => {
            const next =
              clipSync.layoutMode === "stacked" ? "default" : "stacked";
            clipSync.setLayout(next);
          }}
          onToggleLock={() => clipSync.toggleLockMode()}
          onToggleDrawing={() =>
            drawingSync.setTrainerDrawingEnabled(!drawingSync.drawingEnabled)
          }
          onClearDrawing={() => {
            drawingSync.clearCanvas();
            setDrawingOverlayKey((k) => k + 1);
          }}
          bottomOffset={chrome.bottomChrome + 88}
        />
      ) : null}

      {/* Bottom chrome */}
      <ActionButtons
        isTrainer={isTrainer}
        bottomInset={chrome.bottomChrome}
        onOpenClipPicker={isTrainer ? () => setPickerOpen(true) : undefined}
        onScreenshot={isTrainer ? () => void screenshot.takeScreenshot() : undefined}
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
        onSelect={handleClipPicked}
        traineeId={
          isTrainer ? String(session?.trainee_info?._id ?? "") : undefined
        }
        activeClipId={clipSync.activeClipId}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  mainPane: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  mainPaneFullscreen: {
    paddingHorizontal: 0,
    paddingBottom: 120,
  },
  clipFrame: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "#111",
  },
  clipFrameDual: {
    borderRadius: 12,
  },
  singleClip: {
    flex: 1,
  },
  dualRow: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  dualPane: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#0a0a0a",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    padding: 24,
    gap: 12,
  },
  centerText: { color: "#fff", textAlign: "center", fontSize: 14 },
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
