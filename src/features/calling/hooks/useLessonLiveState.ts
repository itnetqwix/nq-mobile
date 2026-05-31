import { useCallback, useEffect, useState } from "react";
import { useSocket } from "../../socket/SocketContext";
import { LESSON_SOCKET_EVENTS } from "../../../lib/sessions/sessionContract";

export type LiveNote = {
  id: string;
  text: string;
  authorId: string;
  elapsedSeconds: number;
  sharedWithTrainee: boolean;
};

export type LiveStateSnapshot = {
  focusedClipId: string | null;
  focusedClipTitle: string | null;
  liveNotes: LiveNote[];
  quality: {
    trainer: { label: string; overallScore: number | null } | null;
    trainee: { label: string; overallScore: number | null } | null;
  };
};

const EMPTY: LiveStateSnapshot = {
  focusedClipId: null,
  focusedClipTitle: null,
  liveNotes: [],
  quality: { trainer: null, trainee: null },
};

type LiveStatePayload = {
  focusedClipId?: string | null;
  focusedClipTitle?: string | null;
  liveNotes?: LiveNote[];
  quality?: LiveStateSnapshot["quality"];
};

function normalizeLiveState(raw?: LiveStatePayload | null): LiveStateSnapshot {
  if (!raw) return EMPTY;
  return {
    focusedClipId: raw.focusedClipId ?? null,
    focusedClipTitle: raw.focusedClipTitle ?? null,
    liveNotes: Array.isArray(raw.liveNotes) ? raw.liveNotes : [],
    quality: raw.quality ?? EMPTY.quality,
  };
}

/**
 * Subscribes to expanded `LESSON_STATE_SYNC` + `LESSON_QUALITY_UPDATE` for
 * agenda focus, live notes, and partner connection quality.
 */
export function useLessonLiveState(sessionId: string, isTrainer: boolean) {
  const { socket } = useSocket();
  const [liveState, setLiveState] = useState<LiveStateSnapshot>(EMPTY);

  useEffect(() => {
    if (!socket || !sessionId) return;

    const onSync = (payload: {
      sessionId?: string;
      liveState?: LiveStatePayload;
    }) => {
      if (String(payload?.sessionId) !== String(sessionId)) return;
      if (payload?.liveState) {
        setLiveState(normalizeLiveState(payload.liveState));
      }
    };

    const onQuality = (payload: {
      sessionId?: string;
      role?: "trainer" | "trainee";
      quality?: { label: string; overallScore: number | null };
    }) => {
      if (String(payload?.sessionId) !== String(sessionId)) return;
      if (!payload?.role || !payload?.quality) return;
      setLiveState((prev) => ({
        ...prev,
        quality: {
          ...prev.quality,
          [payload.role!]: payload.quality!,
        },
      }));
    };

    socket.on(LESSON_SOCKET_EVENTS.STATE_SYNC, onSync);
    socket.on(LESSON_SOCKET_EVENTS.QUALITY_UPDATE, onQuality);
    socket.emit(LESSON_SOCKET_EVENTS.STATE_REQUEST, { sessionId });

    return () => {
      socket.off(LESSON_SOCKET_EVENTS.STATE_SYNC, onSync);
      socket.off(LESSON_SOCKET_EVENTS.QUALITY_UPDATE, onQuality);
    };
  }, [socket, sessionId]);

  const setFocusedClip = useCallback(
    (clipId: string | null, clipTitle?: string | null) => {
      if (!socket?.connected || !sessionId) return;
      socket.emit(LESSON_SOCKET_EVENTS.SET_FOCUSED_CLIP, {
        sessionId,
        clipId,
        clipTitle,
      });
    },
    [socket, sessionId]
  );

  const addLiveNote = useCallback(
    (text: string, elapsedSeconds: number, sharedWithTrainee = false) => {
      if (!socket?.connected || !sessionId || !isTrainer) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      socket.emit(LESSON_SOCKET_EVENTS.LIVE_NOTE_ADD, {
        sessionId,
        text: trimmed,
        elapsedSeconds,
        sharedWithTrainee,
      });
    },
    [socket, sessionId, isTrainer]
  );

  const visibleNotes = isTrainer
    ? liveState.liveNotes
    : liveState.liveNotes.filter((n) => n.sharedWithTrainee);

  return {
    liveState,
    visibleNotes,
    setFocusedClip,
    addLiveNote,
  };
}
