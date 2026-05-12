import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSocket } from "../socket/SocketContext";
import { useAuth } from "../auth/context/AuthContext";
import {
  NOTIFICATION_TITLES,
  NOTIFICATION_TYPES,
  useNotifications,
} from "../notifications/NotificationContext";
import { INSTANT_LESSON_SOCKET as EVENTS } from "./instantLessonSocketEvents";

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
  startBooking: (booking: Omit<TraineeBooking, "step"> & { durationMinutes?: number }) => void;
  cancelBooking: () => void;
  clearTraineeBooking: () => void;
  minimizeBooking: () => void;
  restoreBooking: () => void;
  joinAcceptedLesson: () => void;
};

const InstantLessonContext = createContext<InstantLessonContextValue>({
  trainerIncoming: null,
  traineeBooking: null,
  acceptRequest: () => {},
  declineRequest: () => {},
  startBooking: (_booking: Omit<TraineeBooking, "step"> & { durationMinutes?: number }) => {},
  cancelBooking: () => {},
  clearTraineeBooking: () => {},
  minimizeBooking: () => {},
  restoreBooking: () => {},
  joinAcceptedLesson: () => {},
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
  const { emitNotification } = useNotifications();
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
            : Date.now() + 120_000;
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
      const { lessonId } = payload || {};
      setTraineeBooking((prev) => {
        if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
        return { ...prev, step: "accepted" as const };
      });
    };

    const handleDecline = (payload: any) => {
      const { lessonId } = payload || {};
      setTraineeBooking((prev) => {
        if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
        return { ...prev, step: "declined" as const };
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

    socket.on(EVENTS.REQUEST, handleRequest);
    socket.on(EVENTS.ACCEPT, handleAccept);
    socket.on(EVENTS.DECLINE, handleDecline);
    socket.on(EVENTS.EXPIRE, handleExpire);
    socket.on(EVENTS.TRAINEE_CANCELLED, handleTraineeCancelled);

    return () => {
      socket.off(EVENTS.REQUEST, handleRequest);
      socket.off(EVENTS.ACCEPT, handleAccept);
      socket.off(EVENTS.DECLINE, handleDecline);
      socket.off(EVENTS.EXPIRE, handleExpire);
      socket.off(EVENTS.TRAINEE_CANCELLED, handleTraineeCancelled);
    };
  }, [socket, clearExpiryTimer]);

  const acceptRequest = useCallback(() => {
    if (!trainerIncoming || !socket) return;
    socket.emit(EVENTS.ACCEPT, {
      lessonId: trainerIncoming.lessonId,
      coachId: trainerIncoming.coachId,
      traineeId: trainerIncoming.traineeId,
    });

    /**
     * Persistent inbox entry for the trainee — same `Session Confirmation` title the web
     * uses (`TrainerRenderBooking.jsx`). The trainee also sees the floating banner from
     * `InstantLessonStatusBanner`, but this guarantees an audit trail in their inbox.
     */
    const trainerName = String(
      (user as Record<string, unknown>)?.fullname ??
        (user as Record<string, unknown>)?.fullName ??
        "Your coach"
    );
    emitNotification({
      title: NOTIFICATION_TITLES.sessionConfirmation,
      description: `${trainerName} accepted your instant lesson. Tap Join to enter the session.`,
      receiverId: trainerIncoming.traineeId,
      type: NOTIFICATION_TYPES.TRANSCATIONAL,
      bookingInfo: { lessonId: trainerIncoming.lessonId, isInstant: true },
    });

    clearExpiryTimer();
    const lessonId = trainerIncoming.lessonId;
    setTrainerIncoming(null);
    onNavigateToMeeting(lessonId);
  }, [
    trainerIncoming,
    socket,
    clearExpiryTimer,
    onNavigateToMeeting,
    emitNotification,
    user,
  ]);

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
    (booking: Omit<TraineeBooking, "step"> & { durationMinutes?: number }) => {
      const durationMin = booking.durationMinutes ?? 30;
      const lessonId = String(booking.lessonId);
      const coachId = String(booking.coachId);
      const traineeId = String(booking.traineeId || userId);

      setTraineeBooking({
        ...booking,
        lessonId,
        coachId,
        traineeId,
        step: "waiting",
      });

      /** Align with web `InstantLessonTimeLine` socket emit (ISO `expiresAt`, minutes, `lessonType`). */
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
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
    },
    [socket, userId, user]
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

  const value = useMemo(
    () => ({
      trainerIncoming,
      traineeBooking,
      acceptRequest,
      declineRequest,
      startBooking,
      cancelBooking,
      clearTraineeBooking,
      minimizeBooking,
      restoreBooking,
      joinAcceptedLesson,
    }),
    [
      trainerIncoming,
      traineeBooking,
      acceptRequest,
      declineRequest,
      startBooking,
      cancelBooking,
      clearTraineeBooking,
      minimizeBooking,
      restoreBooking,
      joinAcceptedLesson,
    ]
  );

  return <InstantLessonContext.Provider value={value}>{children}</InstantLessonContext.Provider>;
}

export function useInstantLesson(): InstantLessonContextValue {
  return useContext(InstantLessonContext);
}
