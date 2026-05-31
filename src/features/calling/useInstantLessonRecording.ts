/**
 * Instant-lesson session recording (socket parity + mobile audio capture upload).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import type { Socket } from "socket.io-client";

import { INSTANT_LESSON_SOCKET_EVENTS } from "../../lib/sessions/sessionContract";
import {
  startInstantLessonAudioCapture,
  type InstantRecordingCaptureHandle,
} from "./instantLessonRecordingCapture";
import {
  requestSessionRecordingUpload,
  uploadSessionRecordingFile,
  type SessionRecordingFormat,
} from "./sessionRecordingApi";

/** Native instant recording (audio upload); set false to hide UI only. */
export const INSTANT_RECORDING_CAPTURE_ENABLED = true;

type Args = {
  socket: Socket | null;
  sessionId: string;
  myId: string;
  peerId: string;
  traineeId: string;
  isTrainer: boolean;
  isInstantLesson: boolean;
  lessonTimerStatus: string;
};

export function useInstantLessonRecording({
  socket,
  sessionId,
  myId,
  peerId,
  traineeId,
  isTrainer,
  isInstantLesson,
  lessonTimerStatus,
}: Args) {
  const [trainerRecordingEnabled, setTrainerRecordingEnabled] = useState(false);
  const [trainerRecordingLive, setTrainerRecordingLive] = useState(false);
  const [peerRecordingLive, setPeerRecordingLive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [traineeNoticeOpen, setTraineeNoticeOpen] = useState(false);
  const startedRef = useRef(false);
  const captureRef = useRef<InstantRecordingCaptureHandle | null>(null);
  const peerLiveWasTrueRef = useRef(false);

  const emitRecording = useCallback(
    (enabled: boolean, live: boolean) => {
      if (!socket || !isInstantLesson || !isTrainer) return;
      socket.emit(INSTANT_LESSON_SOCKET_EVENTS.SESSION_RECORDING, {
        userInfo: { from_user: myId, to_user: peerId },
        sessionId,
        enabled,
        live,
      });
    },
    [isInstantLesson, isTrainer, myId, peerId, sessionId, socket]
  );

  const uploadCapture = useCallback(async () => {
    const handle = captureRef.current;
    captureRef.current = null;
    if (!handle || !sessionId || !traineeId) return;
    const uri = await handle.stop();
    if (!uri) return;
    try {
      setUploading(true);
      const format: SessionRecordingFormat = "m4a";
      const url = await requestSessionRecordingUpload({
        sessions: sessionId,
        trainee: traineeId,
        format,
      });
      await uploadSessionRecordingFile(url, uri, format);
      Alert.alert(
        "Recording saved",
        "Session audio was saved. Open Locker → Game plans to review."
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed.";
      Alert.alert("Recording", msg);
    } finally {
      setUploading(false);
    }
  }, [sessionId, traineeId]);

  const stopCaptureAndMaybeUpload = useCallback(async () => {
    if (captureRef.current) {
      await uploadCapture();
    }
  }, [uploadCapture]);

  useEffect(() => {
    if (!socket || !isInstantLesson) return;

    const onRecording = (payload: {
      sessionId?: string;
      enabled?: boolean;
      live?: boolean;
    }) => {
      if (!payload?.sessionId || String(payload.sessionId) !== String(sessionId)) {
        return;
      }
      if (isTrainer) return;
      const live = !!payload.live;
      setPeerRecordingLive(live);
      if (live && !peerLiveWasTrueRef.current) {
        setTraineeNoticeOpen(true);
      }
      if (live) peerLiveWasTrueRef.current = true;
      if (!live) peerLiveWasTrueRef.current = false;
    };

    socket.on(INSTANT_LESSON_SOCKET_EVENTS.SESSION_RECORDING, onRecording);
    return () => {
      socket.off(INSTANT_LESSON_SOCKET_EVENTS.SESSION_RECORDING, onRecording);
    };
  }, [isInstantLesson, isTrainer, sessionId, socket]);

  useEffect(() => {
    if (!isInstantLesson || !isTrainer) {
      setTrainerRecordingEnabled(false);
      setTrainerRecordingLive(false);
      startedRef.current = false;
      captureRef.current = null;
      return;
    }

    const running = lessonTimerStatus === "running";
    if (running && trainerRecordingEnabled && !startedRef.current) {
      startedRef.current = true;
      void (async () => {
        const cap = await startInstantLessonAudioCapture();
        if (!cap) {
          Alert.alert(
            "Recording",
            "Microphone permission is required to record this lesson."
          );
          setTrainerRecordingEnabled(false);
          startedRef.current = false;
          return;
        }
        captureRef.current = cap;
        setTrainerRecordingLive(true);
        emitRecording(true, true);
      })();
      return;
    }

    if (!running && startedRef.current) {
      startedRef.current = false;
      setTrainerRecordingLive(false);
      emitRecording(trainerRecordingEnabled, false);
      void stopCaptureAndMaybeUpload();
    }
  }, [
    emitRecording,
    isInstantLesson,
    isTrainer,
    lessonTimerStatus,
    stopCaptureAndMaybeUpload,
    trainerRecordingEnabled,
  ]);

  useEffect(() => {
    if (!isTrainer || !trainerRecordingEnabled) return;
    emitRecording(true, trainerRecordingLive);
  }, [emitRecording, isTrainer, trainerRecordingEnabled, trainerRecordingLive]);

  const confirmTrainerOptIn = useCallback(() => {
    Alert.alert(
      "Record this lesson?",
      "Audio from this instant lesson will be saved to the session game plan when the lesson ends. The trainee will see a recording indicator.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Record",
          onPress: () => {
            setTrainerRecordingEnabled(true);
            if (lessonTimerStatus === "running") {
              startedRef.current = true;
              void (async () => {
                const cap = await startInstantLessonAudioCapture();
                if (!cap) {
                  Alert.alert(
                    "Recording",
                    "Microphone permission is required to record this lesson."
                  );
                  setTrainerRecordingEnabled(false);
                  startedRef.current = false;
                  return;
                }
                captureRef.current = cap;
                setTrainerRecordingLive(true);
                emitRecording(true, true);
              })();
            } else {
              emitRecording(true, false);
            }
          },
        },
      ]
    );
  }, [emitRecording, lessonTimerStatus]);

  const toggleTrainerRecording = useCallback(() => {
    if (trainerRecordingEnabled) {
      setTrainerRecordingEnabled(false);
      setTrainerRecordingLive(false);
      startedRef.current = false;
      emitRecording(false, false);
      void stopCaptureAndMaybeUpload();
      return;
    }
    confirmTrainerOptIn();
  }, [
    confirmTrainerOptIn,
    emitRecording,
    stopCaptureAndMaybeUpload,
    trainerRecordingEnabled,
  ]);

  const stopTrainerRecording = useCallback(() => {
    setTrainerRecordingLive(false);
    startedRef.current = false;
    emitRecording(trainerRecordingEnabled, false);
    void stopCaptureAndMaybeUpload();
  }, [emitRecording, stopCaptureAndMaybeUpload, trainerRecordingEnabled]);

  const dismissTraineeNotice = useCallback(() => {
    setTraineeNoticeOpen(false);
  }, []);

  const showRecordingBar =
    INSTANT_RECORDING_CAPTURE_ENABLED &&
    isInstantLesson &&
    (isTrainer ? trainerRecordingLive : peerRecordingLive);

  const showTrainerRecordingOptIn =
    INSTANT_RECORDING_CAPTURE_ENABLED &&
    isTrainer &&
    isInstantLesson;

  return {
    showRecordingBar,
    showTrainerRecordingOptIn,
    trainerRecordingEnabled,
    toggleTrainerRecording,
    stopTrainerRecording,
    peerRecordingLive,
    uploading,
    traineeNoticeOpen,
    dismissTraineeNotice,
  };
}
