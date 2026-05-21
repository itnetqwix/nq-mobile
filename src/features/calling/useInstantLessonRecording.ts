/**
 * Instant-lesson session recording indicator (socket parity with web
 * `InstantLessonRecordingBar.jsx`). Native capture/upload is a follow-up;
 * this wires trainer opt-in + peer "REC" UI state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import { INSTANT_LESSON_SOCKET_EVENTS } from "../../lib/sessions/sessionContract";

type Args = {
  socket: Socket | null;
  sessionId: string;
  myId: string;
  peerId: string;
  isTrainer: boolean;
  isInstantLesson: boolean;
  lessonTimerStatus: string;
};

export function useInstantLessonRecording({
  socket,
  sessionId,
  myId,
  peerId,
  isTrainer,
  isInstantLesson,
  lessonTimerStatus,
}: Args) {
  const [trainerRecordingEnabled, setTrainerRecordingEnabled] = useState(false);
  const [trainerRecordingLive, setTrainerRecordingLive] = useState(false);
  const [peerRecordingLive, setPeerRecordingLive] = useState(false);
  const startedRef = useRef(false);

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
      setPeerRecordingLive(!!payload.live);
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
      return;
    }

    const running = lessonTimerStatus === "running";
    if (running && trainerRecordingEnabled && !startedRef.current) {
      startedRef.current = true;
      setTrainerRecordingLive(true);
      emitRecording(true, true);
      return;
    }

    if (!running && startedRef.current) {
      startedRef.current = false;
      setTrainerRecordingLive(false);
      emitRecording(trainerRecordingEnabled, false);
    }
  }, [
    emitRecording,
    isInstantLesson,
    isTrainer,
    lessonTimerStatus,
    trainerRecordingEnabled,
  ]);

  useEffect(() => {
    if (!isTrainer || !trainerRecordingEnabled) return;
    emitRecording(true, trainerRecordingLive);
  }, [emitRecording, isTrainer, trainerRecordingEnabled, trainerRecordingLive]);

  const toggleTrainerRecording = useCallback(() => {
    setTrainerRecordingEnabled((prev) => {
      const next = !prev;
      if (!next) {
        setTrainerRecordingLive(false);
        startedRef.current = false;
        emitRecording(false, false);
      } else if (lessonTimerStatus === "running") {
        startedRef.current = true;
        setTrainerRecordingLive(true);
        emitRecording(true, true);
      } else {
        emitRecording(true, false);
      }
      return next;
    });
  }, [emitRecording, lessonTimerStatus]);

  const stopTrainerRecording = useCallback(() => {
    setTrainerRecordingLive(false);
    startedRef.current = false;
    emitRecording(trainerRecordingEnabled, false);
  }, [emitRecording, trainerRecordingEnabled]);

  const showRecordingBar =
    isInstantLesson &&
    (isTrainer ? trainerRecordingLive : peerRecordingLive);

  return {
    showRecordingBar,
    trainerRecordingEnabled,
    toggleTrainerRecording,
    stopTrainerRecording,
    peerRecordingLive,
  };
}
