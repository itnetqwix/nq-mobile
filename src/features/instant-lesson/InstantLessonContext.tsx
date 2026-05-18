import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Vibration } from "react-native";
import { useSocket } from "../socket/SocketContext";
import { useAuth } from "../auth/context/AuthContext";
import {
  INSTANT_ACCEPT_WINDOW_MS,
  INSTANT_JOIN_AFTER_ACCEPT_MS,
} from "../../lib/sessions/instantLessonConstants";
import { INSTANT_LESSON_SOCKET as EVENTS } from "./instantLessonSocketEvents";
import {
  registerInstantLessonHandlers,
  type InstantLessonPhasePayload,
} from "./instantLessonBridge";

/** Short "session confirmed" haptic — two quick taps. Vibration is the
 *  cross-platform built-in; we'll layer expo-haptics on top in Phase 4b. */
const ACCEPT_HAPTIC_PATTERN: number[] = [0, 40, 80, 40];

export type TrainerIncoming = {
  lessonId: string;
  coachId: string;
  traineeId: string;
  traineeInfo: { _id: string; fullname: string; profile_picture?: string };
  expiresAt: number;
  duration?: number;
  lessonType?: string;
};

export type TraineeBooking = {
  lessonId: string;
  coachId: string;
  traineeId: string;
  trainerName: string;
  step: "waiting" | "accepted" | "declined" | "expired";
  acceptDeadlineAt?: number;
  joinDeadlineAt?: number;
  /**
   * When true, the full-screen waiting modal is hidden and only a small floating
   * pill remains so the trainee can keep using the app while waiting.
   */
  minimized?: boolean;
};

type InstantLessonContextValue = {
  trainerIncoming: TrainerIncoming | null;
  traineeBooking: TraineeBooking | null;
  acceptRequest: () => void;
  declineRequest: () => void;
  expireRequest: () => void;
  startBooking: (
    booking: Omit<TraineeBooking, "step"> & { durationMinutes?: number; acceptDeadlineAt?: number }
  ) => void;
  cancelBooking: () => void;
  clearTraineeBooking: () => void;
  minimizeBooking: () => void;
  restoreBooking: () => void;
  joinAcceptedLesson: () => void;
  /** Re-open the trainer accept modal from a session row (e.g. upcoming list). */
  focusTrainerRequestFromSession: (session: Record<string, unknown>) => void;
};

const InstantLessonContext = createContext<InstantLessonContextValue>({
  trainerIncoming: null,
  traineeBooking: null,
  acceptRequest: () => {},
  declineRequest: () => {},
  expireRequest: () => {},
  startBooking: (_booking: Omit<TraineeBooking, "step"> & { durationMinutes?: number }) => {},
  cancelBooking: () => {},
  clearTraineeBooking: () => {},
  minimizeBooking: () => {},
  restoreBooking: () => {},
  joinAcceptedLesson: () => {},
  focusTrainerRequestFromSession: () => {},
});

export function InstantLessonProvider({
  children,
  onNavigateToMeeting,
}: {
  children: React.ReactNode;
  onNavigateToMeeting: (lessonId: string) => void;
}) {
  const { socket } = useSocket();
  const { user, status: authStatus } = useAuth();
  const [trainerIncoming, setTrainerIncoming] = useState<TrainerIncoming | null>(null);
  const [traineeBooking, setTraineeBooking] = useState<TraineeBooking | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** If the trainee books before the socket exists, emit REQUEST once the connection is ready. */
  const pendingInstantRequestRef = useRef<Record<string, unknown> | null>(null);
  /** Avoid double navigation to Meeting when the coach accepts (Strict Mode / duplicate events). */
  const traineeAutoMeetingLessonRef = useRef<string | null>(null);

  const userId = user ? String((user as any)?._id ?? (user as any)?.id ?? "") : "";

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (authStatus === "signedIn") return;
    clearExpiryTimer();
    pendingInstantRequestRef.current = null;
    traineeAutoMeetingLessonRef.current = null;
    setTrainerIncoming(null);
    setTraineeBooking(null);
  }, [authStatus, clearExpiryTimer]);

  useEffect(() => {
    if (!socket || !pendingInstantRequestRef.current) return;
    const payload = pendingInstantRequestRef.current;
    pendingInstantRequestRef.current = null;
    socket.emit(EVENTS.REQUEST, payload);
  }, [socket]);

  /**
   * When the coach accepts, surface an in-app "Confirmed — tap to join" banner instead of
   * auto-navigating. The trainee can be elsewhere in the app (because the waiting modal is
   * dismissible now), so we keep the booking in `accepted` state until they tap Join.
   */
  useEffect(() => {
    if (!traineeBooking) {
      traineeAutoMeetingLessonRef.current = null;
    }
  }, [traineeBooking]);

  useEffect(() => {
    if (!socket) return;

    const handleRequest = (payload: any) => {
      const { lessonId, coachId, traineeId, traineeInfo, expiresAt, duration, lessonType } = payload;
      clearExpiryTimer();
      const expiresMs =
        typeof expiresAt === "string"
          ? new Date(expiresAt).getTime()
          : typeof expiresAt === "number"
            ? expiresAt
            : Date.now() + INSTANT_ACCEPT_WINDOW_MS;
      setTrainerIncoming({
        lessonId,
        coachId,
        traineeId,
        traineeInfo,
        expiresAt: expiresMs,
        duration,
        lessonType,
      });
      const msUntilExpiry = Math.max(0, expiresMs - Date.now());
      expiryTimerRef.current = setTimeout(() => setTrainerIncoming(null), msUntilExpiry);
    };

    const handleAccept = (payload: any) => {
      const { lessonId, joinDeadlineAt } = payload || {};
      const joinMs = joinDeadlineAt
        ? new Date(joinDeadlineAt).getTime()
        : Date.now() + INSTANT_JOIN_AFTER_ACCEPT_MS;
      setTraineeBooking((prev) => {
        if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
        try {
          Vibration.vibrate(ACCEPT_HAPTIC_PATTERN);
        } catch {
          /** Vibration may be unavailable (simulator); ignore. */
        }
        return {
          ...prev,
          step: "accepted" as const,
          minimized: false,
          joinDeadlineAt: joinMs,
        };
      });
    };

    const applyPhase = (payload: InstantLessonPhasePayload) => {
      const { lessonId, phase, refundReason } = payload || {};
      if (phase === "cancelled") {
        setTraineeBooking((prev) => {
          if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
          return {
            ...prev,
            step: refundReason === "declined" ? ("declined" as const) : ("expired" as const),
            minimized: false,
          };
        });
        setTrainerIncoming((prev) => {
          if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
          return null;
        });
      }
    };

    const handlePhase = (payload: InstantLessonPhasePayload) => {
      applyPhase(payload);
    };

    const handleDecline = (payload: any) => {
      const { lessonId } = payload || {};
      setTraineeBooking((prev) => {
        if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
        return { ...prev, step: "declined" as const, minimized: false };
      });
    };

    const handleExpire = (payload: any) => {
      const { lessonId } = payload || {};
      clearExpiryTimer();
      setTrainerIncoming((prev) => {
        if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
        return null;
      });
      setTraineeBooking((prev) => {
        if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
        return { ...prev, step: "expired" as const };
      });
    };

    const handleTraineeCancelled = (payload: any) => {
      const { lessonId } = payload || {};
      clearExpiryTimer();
      setTrainerIncoming((prev) => {
        if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
        return null;
      });
    };

    registerInstantLessonHandlers({ onPhase: applyPhase });

    socket.on(EVENTS.REQUEST, handleRequest);
    socket.on(EVENTS.ACCEPT, handleAccept);
    socket.on(EVENTS.DECLINE, handleDecline);
    socket.on(EVENTS.EXPIRE, handleExpire);
    socket.on(EVENTS.PHASE, handlePhase);
    socket.on(EVENTS.TRAINEE_CANCELLED, handleTraineeCancelled);

    return () => {
      registerInstantLessonHandlers({});
      socket.off(EVENTS.REQUEST, handleRequest);
      socket.off(EVENTS.ACCEPT, handleAccept);
      socket.off(EVENTS.DECLINE, handleDecline);
      socket.off(EVENTS.EXPIRE, handleExpire);
      socket.off(EVENTS.PHASE, handlePhase);
      socket.off(EVENTS.TRAINEE_CANCELLED, handleTraineeCancelled);
    };
  }, [socket, clearExpiryTimer]);

  const acceptRequest = useCallback(() => {
    if (!trainerIncoming || !socket) return;
    const { lessonId, coachId, traineeId } = trainerIncoming;
    socket.emit(
      EVENTS.ACCEPT,
      { lessonId, coachId, traineeId },
      (response?: { ok?: boolean; error?: string; message?: string }) => {
        if (!response?.ok) return;

        clearExpiryTimer();
        setTrainerIncoming(null);
        onNavigateToMeeting(lessonId);
      }
    );
  }, [trainerIncoming, socket, clearExpiryTimer, onNavigateToMeeting]);

  const expireRequest = useCallback(() => {
    if (!trainerIncoming || !socket) return;
    socket.emit(EVENTS.EXPIRE, {
      lessonId: trainerIncoming.lessonId,
      coachId: trainerIncoming.coachId,
      traineeId: trainerIncoming.traineeId,
    });
    clearExpiryTimer();
    setTrainerIncoming(null);
  }, [trainerIncoming, socket, clearExpiryTimer]);

  const declineRequest = useCallback(() => {
    if (!trainerIncoming || !socket) return;
    socket.emit(EVENTS.DECLINE, {
      lessonId: trainerIncoming.lessonId,
      coachId: trainerIncoming.coachId,
      traineeId: trainerIncoming.traineeId,
    });
    clearExpiryTimer();
    setTrainerIncoming(null);
  }, [trainerIncoming, socket, clearExpiryTimer]);

  const startBooking = useCallback(
    (
      booking: Omit<TraineeBooking, "step"> & {
        durationMinutes?: number;
        acceptDeadlineAt?: number;
      }
    ) => {
      const durationMin = booking.durationMinutes ?? 30;
      const lessonId = String(booking.lessonId);
      const coachId = String(booking.coachId);
      const traineeId = String(booking.traineeId || userId);

      const acceptDeadlineAt =
        booking.acceptDeadlineAt && booking.acceptDeadlineAt > Date.now()
          ? booking.acceptDeadlineAt
          : Date.now() + INSTANT_ACCEPT_WINDOW_MS;
      setTraineeBooking({
        ...booking,
        lessonId,
        coachId,
        traineeId,
        step: "waiting",
        acceptDeadlineAt,
      });

      const expiresAt = new Date(acceptDeadlineAt).toISOString();
      const payload = {
        lessonId,
        coachId,
        traineeId,
        traineeInfo: {
          _id: userId,
          fullname: (user as any)?.fullname ?? (user as any)?.fullName ?? "Trainee",
          profile_picture: (user as any)?.profile_picture,
        },
        expiresAt,
        duration: durationMin,
        lessonType: `Instant Lesson - ${durationMin} min`,
      };

      if (socket) {
        socket.emit(EVENTS.REQUEST, payload);
      } else {
        pendingInstantRequestRef.current = payload;
      }

      clearExpiryTimer();
      const msUntilExpiry = Math.max(0, acceptDeadlineAt - Date.now());
      expiryTimerRef.current = setTimeout(() => {
        setTraineeBooking((prev) => {
          if (!prev || String(prev.lessonId) !== lessonId) return prev;
          if (prev.step !== "waiting") return prev;
          return { ...prev, step: "expired" as const };
        });
      }, msUntilExpiry);
    },
    [socket, userId, user, clearExpiryTimer]
  );

  const cancelBooking = useCallback(() => {
    if (!traineeBooking) return;
    const pending = pendingInstantRequestRef.current;
    if (pending && String((pending as any).lessonId) === String(traineeBooking.lessonId)) {
      pendingInstantRequestRef.current = null;
    }
    if (socket) {
      socket.emit(EVENTS.TRAINEE_CANCELLED, {
        lessonId: traineeBooking.lessonId,
        coachId: traineeBooking.coachId,
        traineeId: traineeBooking.traineeId,
      });
    }
    setTraineeBooking(null);
  }, [traineeBooking, socket]);

  const clearTraineeBooking = useCallback(() => {
    setTraineeBooking(null);
  }, []);

  const minimizeBooking = useCallback(() => {
    setTraineeBooking((prev) => (prev ? { ...prev, minimized: true } : prev));
  }, []);

  const restoreBooking = useCallback(() => {
    setTraineeBooking((prev) => (prev ? { ...prev, minimized: false } : prev));
  }, []);

  const joinAcceptedLesson = useCallback(() => {
    if (!traineeBooking || traineeBooking.step !== "accepted") return;
    const lid = String(traineeBooking.lessonId);
    if (traineeAutoMeetingLessonRef.current === lid) return;
    traineeAutoMeetingLessonRef.current = lid;
    onNavigateToMeeting(lid);
    setTraineeBooking(null);
  }, [traineeBooking, onNavigateToMeeting]);

  const focusTrainerRequestFromSession = useCallback(
    (session: Record<string, unknown>) => {
      const lessonId = String(session._id ?? session.id ?? "");
      if (!lessonId) return;
      const acceptRaw = session.accept_deadline_at ?? session.acceptDeadlineAt;
      const acceptMs = acceptRaw
        ? new Date(String(acceptRaw)).getTime()
        : Date.now() + INSTANT_ACCEPT_WINDOW_MS;
      const traineeInfo = (session.trainee_info ?? {}) as TrainerIncoming["traineeInfo"];
      setTrainerIncoming({
        lessonId,
        coachId: String(session.trainer_id ?? userId),
        traineeId: String(session.trainee_id ?? ""),
        traineeInfo: {
          _id: String(traineeInfo._id ?? session.trainee_id ?? ""),
          fullname: traineeInfo.fullname ?? "Trainee",
          profile_picture: traineeInfo.profile_picture,
        },
        expiresAt: Number.isFinite(acceptMs) ? acceptMs : Date.now() + INSTANT_ACCEPT_WINDOW_MS,
        duration: Number(session.duration_minutes) || 30,
        lessonType: `Instant Lesson - ${Number(session.duration_minutes) || 30} min`,
      });
    },
    [userId]
  );

  const value = useMemo(
    () => ({
      trainerIncoming,
      traineeBooking,
      acceptRequest,
      declineRequest,
      expireRequest,
      startBooking,
      cancelBooking,
      clearTraineeBooking,
      minimizeBooking,
      restoreBooking,
      joinAcceptedLesson,
      focusTrainerRequestFromSession,
    }),
    [
      trainerIncoming,
      traineeBooking,
      acceptRequest,
      declineRequest,
      expireRequest,
      startBooking,
      cancelBooking,
      clearTraineeBooking,
      minimizeBooking,
      restoreBooking,
      joinAcceptedLesson,
      focusTrainerRequestFromSession,
    ]
  );

  return <InstantLessonContext.Provider value={value}>{children}</InstantLessonContext.Provider>;
}

export function useInstantLesson(): InstantLessonContextValue {
  return useContext(InstantLessonContext);
}
