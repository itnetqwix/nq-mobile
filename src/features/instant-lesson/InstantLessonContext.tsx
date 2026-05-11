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

const EVENTS = {
  REQUEST: "INSTANT_LESSON_REQUEST",
  ACCEPT: "INSTANT_LESSON_ACCEPT",
  DECLINE: "INSTANT_LESSON_DECLINE",
  EXPIRE: "INSTANT_LESSON_EXPIRE",
  TRAINEE_CANCELLED: "INSTANT_LESSON_TRAINEE_CANCELLED",
} as const;

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
};

type InstantLessonContextValue = {
  trainerIncoming: TrainerIncoming | null;
  traineeBooking: TraineeBooking | null;
  acceptRequest: () => void;
  declineRequest: () => void;
  startBooking: (booking: Omit<TraineeBooking, "step">) => void;
  cancelBooking: () => void;
  clearTraineeBooking: () => void;
};

const InstantLessonContext = createContext<InstantLessonContextValue>({
  trainerIncoming: null,
  traineeBooking: null,
  acceptRequest: () => {},
  declineRequest: () => {},
  startBooking: () => {},
  cancelBooking: () => {},
  clearTraineeBooking: () => {},
});

export function InstantLessonProvider({
  children,
  onNavigateToMeeting,
}: {
  children: React.ReactNode;
  onNavigateToMeeting: (lessonId: string) => void;
}) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [trainerIncoming, setTrainerIncoming] = useState<TrainerIncoming | null>(null);
  const [traineeBooking, setTraineeBooking] = useState<TraineeBooking | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = user ? String((user as any)?._id ?? (user as any)?.id ?? "") : "";

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleRequest = (payload: any) => {
      const { lessonId, coachId, traineeId, traineeInfo, expiresAt, duration, lessonType } = payload;
      clearExpiryTimer();
      setTrainerIncoming({ lessonId, coachId, traineeId, traineeInfo, expiresAt, duration, lessonType });
      const msUntilExpiry = Math.max(0, (expiresAt || Date.now() + 60000) - Date.now());
      expiryTimerRef.current = setTimeout(() => setTrainerIncoming(null), msUntilExpiry);
    };

    const handleAccept = (payload: any) => {
      const { lessonId } = payload;
      setTraineeBooking((prev) => {
        if (!prev || prev.lessonId !== lessonId) return prev;
        return { ...prev, step: "accepted" as const };
      });
    };

    const handleDecline = (payload: any) => {
      const { lessonId } = payload;
      setTraineeBooking((prev) => {
        if (!prev || prev.lessonId !== lessonId) return prev;
        return { ...prev, step: "declined" as const };
      });
    };

    const handleExpire = (payload: any) => {
      const { lessonId } = payload;
      clearExpiryTimer();
      setTrainerIncoming(null);
      setTraineeBooking((prev) => {
        if (!prev || prev.lessonId !== lessonId) return prev;
        return { ...prev, step: "expired" as const };
      });
    };

    socket.on(EVENTS.REQUEST, handleRequest);
    socket.on(EVENTS.ACCEPT, handleAccept);
    socket.on(EVENTS.DECLINE, handleDecline);
    socket.on(EVENTS.EXPIRE, handleExpire);

    return () => {
      socket.off(EVENTS.REQUEST, handleRequest);
      socket.off(EVENTS.ACCEPT, handleAccept);
      socket.off(EVENTS.DECLINE, handleDecline);
      socket.off(EVENTS.EXPIRE, handleExpire);
    };
  }, [socket, clearExpiryTimer]);

  const acceptRequest = useCallback(() => {
    if (!trainerIncoming || !socket) return;
    socket.emit(EVENTS.ACCEPT, {
      lessonId: trainerIncoming.lessonId,
      coachId: trainerIncoming.coachId,
      traineeId: trainerIncoming.traineeId,
    });
    clearExpiryTimer();
    const lessonId = trainerIncoming.lessonId;
    setTrainerIncoming(null);
    onNavigateToMeeting(lessonId);
  }, [trainerIncoming, socket, clearExpiryTimer, onNavigateToMeeting]);

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
    (booking: Omit<TraineeBooking, "step">) => {
      setTraineeBooking({ ...booking, step: "waiting" });
      if (!socket) return;
      socket.emit(EVENTS.REQUEST, {
        lessonId: booking.lessonId,
        coachId: booking.coachId,
        traineeId: booking.traineeId || userId,
        traineeInfo: {
          _id: userId,
          fullname: (user as any)?.fullname ?? (user as any)?.fullName ?? "Trainee",
          profile_picture: (user as any)?.profile_picture,
        },
        expiresAt: Date.now() + 60000,
        duration: 30 * 60,
      });
    },
    [socket, userId, user]
  );

  const cancelBooking = useCallback(() => {
    if (!traineeBooking || !socket) return;
    socket.emit(EVENTS.TRAINEE_CANCELLED, {
      lessonId: traineeBooking.lessonId,
      coachId: traineeBooking.coachId,
      traineeId: traineeBooking.traineeId,
    });
    setTraineeBooking(null);
  }, [traineeBooking, socket]);

  const clearTraineeBooking = useCallback(() => {
    setTraineeBooking(null);
  }, []);

  const value = useMemo(
    () => ({
      trainerIncoming,
      traineeBooking,
      acceptRequest,
      declineRequest,
      startBooking,
      cancelBooking,
      clearTraineeBooking,
    }),
    [trainerIncoming, traineeBooking, acceptRequest, declineRequest, startBooking, cancelBooking, clearTraineeBooking]
  );

  return <InstantLessonContext.Provider value={value}>{children}</InstantLessonContext.Provider>;
}

export function useInstantLesson(): InstantLessonContextValue {
  return useContext(InstantLessonContext);
}
