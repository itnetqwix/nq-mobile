/**
 * Instant-lesson session recording (socket parity + mobile capture upload).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import type { Socket } from "socket.io-client";

import { INSTANT_LESSON_SOCKET_EVENTS } from "../../lib/sessions/sessionContract";
import {
  startInstantLessonAudioCapture,
  type InstantRecordingCaptureHandle,
} from "./instantLessonRecordingCapture";
import { muxLessonRecordingUpload } from "./lessonRecordingCompose";
import {
  LESSON_STAGE_FRAME_SAMPLER_ENABLED,
  startLessonStageFrameSampler,
  type LessonStageFrameSamplerHandle,
} from "./lessonStageFrameSampler";
import {
  requestSessionRecordingUpload,
  uploadSessionRecordingFile,
  type SessionRecordingFormat,
} from "./sessionRecordingApi";

/** Native instant recording (audio + stage video); set false to hide UI only. */
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
  captureStageFrame?: () => Promise<string | null>;
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
  captureStageFrame,
}: Args) {
  const [trainerRecordingEnabled, setTrainerRecordingEnabled] = useState(false);
  const [trainerRecordingLive, setTrainerRecordingLive] = useState(false);
  const [peerRecordingLive, setPeerRecordingLive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [traineeNoticeOpen, setTraineeNoticeOpen] = useState(false);
  const startedRef = useRef(false);
  const captureRef = useRef<InstantRecordingCaptureHandle | null>(null);
  const frameSamplerRef = useRef<LessonStageFrameSamplerHandle | null>(null);
  const peerLiveWasTrueRef = useRef(false);

  const startStageSamplerIfNeeded = useCallback(() => {
    if (
      !LESSON_STAGE_FRAME_SAMPLER_ENABLED ||
      !captureStageFrame ||
      frameSamplerRef.current
    ) {
      return;
    }
    frameSamplerRef.current = startLessonStageFrameSampler(captureStageFrame);
  }, [captureStageFrame]);

  const stopStageSampler = useCallback(async () => {
    const sampler = frameSamplerRef.current;
    frameSamplerRef.current = null;
    if (!sampler) return [];
    return sampler.stop();
  }, []);

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

  const uploadRecordingAsset = useCallback(
    async (localUri: string, format: SessionRecordingFormat) => {
      if (!sessionId || !traineeId) return;
      setUploading(true);
      try {
        const url = await requestSessionRecordingUpload({
          sessions: sessionId,
          trainee: traineeId,
          format,
        });
        await uploadSessionRecordingFile(url, localUri, format);
        Alert.alert(
          "Recording saved",
          format === "mp4"
            ? "Session video was saved to the game plan. Open Locker → Game plans to review."
            : "Session audio was saved. Open Locker → Game plans to review."
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Upload failed.";
        Alert.alert("Recording", msg);
      } finally {
        setUploading(false);
      }
    },
    [sessionId, traineeId]
  );

  const finalizeAndUpload = useCallback(async () => {
    const frames = await stopStageSampler();
    const audioHandle = captureRef.current;
    captureRef.current = null;

    let audioUri: string | null = null;
    if (audioHandle) {
      audioUri = await audioHandle.stop();
    }

    if (!audioUri && frames.length < 2) return;

    const asset = await muxLessonRecordingUpload({
      frameUris: frames,
      audioUri,
    });
    if (!asset) return;
    await uploadRecordingAsset(asset.uri, asset.format);
  }, [stopStageSampler, uploadRecordingAsset]);

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
        startStageSamplerIfNeeded();
        setTrainerRecordingLive(true);
        emitRecording(true, true);
      })();
      return;
    }

    if (!running && startedRef.current) {
      startedRef.current = false;
      setTrainerRecordingLive(false);
      emitRecording(trainerRecordingEnabled, false);
      void finalizeAndUpload();
    }
  }, [
    emitRecording,
    finalizeAndUpload,
    isInstantLesson,
    isTrainer,
    lessonTimerStatus,
    startStageSamplerIfNeeded,
    trainerRecordingEnabled,
  ]);

  useEffect(() => {
    if (!isTrainer || !trainerRecordingEnabled) return;
    emitRecording(true, trainerRecordingLive);
  }, [emitRecording, isTrainer, trainerRecordingEnabled, trainerRecordingLive]);

  const confirmTrainerOptIn = useCallback(() => {
    Alert.alert(
      "Record this lesson?",
      "Audio and lesson video snapshots will be saved to the session game plan when the lesson ends. The trainee will see a recording indicator.",
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
                startStageSamplerIfNeeded();
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
  }, [emitRecording, lessonTimerStatus, startStageSamplerIfNeeded]);

  const toggleTrainerRecording = useCallback(() => {
    if (trainerRecordingEnabled) {
      setTrainerRecordingEnabled(false);
      setTrainerRecordingLive(false);
      startedRef.current = false;
      emitRecording(false, false);
      void finalizeAndUpload();
      return;
    }
    confirmTrainerOptIn();
  }, [confirmTrainerOptIn, emitRecording, finalizeAndUpload, trainerRecordingEnabled]);

  const stopTrainerRecording = useCallback(() => {
    setTrainerRecordingLive(false);
    startedRef.current = false;
    emitRecording(trainerRecordingEnabled, false);
    void finalizeAndUpload();
  }, [emitRecording, finalizeAndUpload, trainerRecordingEnabled]);

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
