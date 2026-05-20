import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Vibration } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "../socket/SocketContext";
import { useAuth } from "../auth/context/AuthContext";
import {
  INSTANT_ACCEPT_WINDOW_MS,
  INSTANT_JOIN_AFTER_ACCEPT_MS,
} from "../../lib/sessions/instantLessonConstants";
import { isInstantLesson, normalizeSessionStatus } from "../../lib/sessions/sessionUtils";
import { INSTANT_LESSON_SOCKET as EVENTS } from "./instantLessonSocketEvents";
import {
  registerInstantLessonActionHandlers,
  registerInstantLessonHandlers,
  type InstantLessonIncomingPayload,
  type InstantLessonPhasePayload,
} from "./instantLessonBridge";
import {
  endAllInstantLessonCalls,
  endInstantLessonCall,
  shouldUseNativeIncomingCallUi,
} from "./instantLessonCallKeep";
import { presentNativeInstantLessonIncoming } from "./InstantLessonCallKeepBridge";
import {
  dismissInstantLessonIncomingCall,
  presentInstantLessonIncomingCall,
} from "./instantLessonIncomingNotifications";
import { consumeInstantLessonNotificationAction } from "./instantLessonPendingAction";
import { useInstantLessonRingtone } from "./useInstantLessonRingtone";

const ACCEPT_HAPTIC_PATTERN: number[] = [0, 40, 80, 40];

export type TrainerIncoming = {
  lessonId: string;
  coachId: string;
  traineeId: string;
  traineeInfo: { _id: string; fullname: string; profile_picture?: string };
  /** Accept-window deadline (incoming) or join-window deadline (accepted). */
  expiresAt: number;
  joinDeadlineAt?: number;
  step: "incoming" | "accepted";
  minimized?: boolean;
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
  joinTrainerLesson: () => void;
  minimizeTrainerAccepted: () => void;
  restoreTrainerAccepted: () => void;
  restoreTrainerIncoming: () => void;
  clearTrainerIncoming: () => void;
  focusTrainerRequestFromSession: (session: Record<string, unknown>) => void;
  restoreTraineeFlowFromSession: (
    session: Record<string, unknown>,
    step: "waiting" | "accepted"
  ) => void;
  acceptInstantSession: (session: Record<string, unknown>) => Promise<void>;
  declineInstantSession: (session: Record<string, unknown>) => Promise<void>;
};

const InstantLessonContext = createContext<InstantLessonContextValue>({
  trainerIncoming: null,
  traineeBooking: null,
  acceptRequest: () => {},
  declineRequest: () => {},
  expireRequest: () => {},
  startBooking: () => {},
  cancelBooking: () => {},
  clearTraineeBooking: () => {},
  minimizeBooking: () => {},
  restoreBooking: () => {},
  joinAcceptedLesson: () => {},
  joinTrainerLesson: () => {},
  minimizeTrainerAccepted: () => {},
  restoreTrainerAccepted: () => {},
  restoreTrainerIncoming: () => {},
  clearTrainerIncoming: () => {},
  focusTrainerRequestFromSession: () => {},
  restoreTraineeFlowFromSession: () => {},
  acceptInstantSession: async () => {},
  declineInstantSession: async () => {},
});

export function InstantLessonProvider({
  children,
  onNavigateToMeeting,
}: {
  children: React.ReactNode;
  onNavigateToMeeting: (lessonId: string) => void;
}) {
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const { user, status: authStatus } = useAuth();
  const [trainerIncoming, setTrainerIncoming] = useState<TrainerIncoming | null>(null);
  const [traineeBooking, setTraineeBooking] = useState<TraineeBooking | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingInstantRequestRef = useRef<Record<string, unknown> | null>(null);
  const traineeAutoMeetingLessonRef = useRef<string | null>(null);
  const trainerAutoMeetingLessonRef = useRef<string | null>(null);
  const { startRinging, stopRinging } = useInstantLessonRingtone();

  const userId = user ? String((user as any)?._id ?? (user as any)?.id ?? "") : "";

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const scheduleExpiry = useCallback(
    (deadlineMs: number, onFire: () => void) => {
      clearExpiryTimer();
      const ms = Math.max(0, deadlineMs - Date.now());
      expiryTimerRef.current = setTimeout(onFire, ms);
    },
    [clearExpiryTimer]
  );

  useEffect(() => {
    if (authStatus === "signedIn") return;
    clearExpiryTimer();
    pendingInstantRequestRef.current = null;
    traineeAutoMeetingLessonRef.current = null;
    trainerAutoMeetingLessonRef.current = null;
    void endAllInstantLessonCalls();
    setTrainerIncoming(null);
    setTraineeBooking(null);
  }, [authStatus, clearExpiryTimer]);

  useEffect(() => {
    if (!socket || !pendingInstantRequestRef.current) return;
    const payload = pendingInstantRequestRef.current;
    pendingInstantRequestRef.current = null;
    socket.emit(EVENTS.REQUEST, payload);
  }, [socket]);

  useEffect(() => {
    if (!traineeBooking) traineeAutoMeetingLessonRef.current = null;
  }, [traineeBooking]);

  useEffect(() => {
    if (!trainerIncoming) trainerAutoMeetingLessonRef.current = null;
  }, [trainerIncoming]);

  const applyIncomingRequest = useCallback(
    (payload: InstantLessonIncomingPayload) => {
      clearExpiryTimer();
      setTrainerIncoming({
        lessonId: payload.lessonId,
        coachId: payload.coachId,
        traineeId: payload.traineeId,
        traineeInfo: payload.traineeInfo,
        expiresAt: payload.expiresAt,
        step: "incoming",
        minimized: false,
        duration: payload.duration,
        lessonType: payload.lessonType,
      });
      scheduleExpiry(payload.expiresAt, () => {
        void dismissInstantLessonIncomingCall(payload.lessonId);
        void endInstantLessonCall(payload.lessonId);
        setTrainerIncoming(null);
      });

      void (async () => {
        const nativeShown = await presentNativeInstantLessonIncoming(payload);
        if (!nativeShown) {
          void startRinging();
          if (AppState.currentState !== "active") {
            void presentInstantLessonIncomingCall(payload);
          }
        } else {
          void stopRinging();
        }
      })();
    },
    [clearExpiryTimer, scheduleExpiry, startRinging, stopRinging]
  );

  useEffect(() => {
    registerInstantLessonHandlers({ onIncomingRequest: applyIncomingRequest });
  }, [applyIncomingRequest]);

  useEffect(() => {
    if (!socket) return;

    const handleRequest = (payload: any) => {
      const { lessonId, coachId, traineeId, traineeInfo, expiresAt, duration, lessonType } =
        payload;
      const expiresMs =
        typeof expiresAt === "string"
          ? new Date(expiresAt).getTime()
          : typeof expiresAt === "number"
            ? expiresAt
            : Date.now() + INSTANT_ACCEPT_WINDOW_MS;
      applyIncomingRequest({
        lessonId: String(lessonId),
        coachId: String(coachId),
        traineeId: String(traineeId),
        traineeInfo: traineeInfo ?? {
          _id: String(traineeId),
          fullname: "Trainee",
        },
        expiresAt: expiresMs,
        duration,
        lessonType,
      });
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
          /** ignore */
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
      const { lessonId, phase, refundReason, joinDeadlineAt, coachId, traineeId } = payload || {};
      const phaseLower = String(phase ?? "").toLowerCase();

      if (phaseLower === "cancelled") {
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
        return;
      }

      if (phaseLower === "pending_join" && lessonId) {
        const joinMs = joinDeadlineAt
          ? new Date(String(joinDeadlineAt)).getTime()
          : Date.now() + INSTANT_JOIN_AFTER_ACCEPT_MS;
        if (Number.isFinite(joinMs)) {
          setTraineeBooking((prev) => {
            if (prev && String(prev.lessonId) !== String(lessonId)) return prev;
            return {
              lessonId: String(lessonId),
              coachId: String(coachId ?? prev?.coachId ?? ""),
              traineeId: String(traineeId ?? prev?.traineeId ?? userId),
              trainerName: prev?.trainerName ?? "Coach",
              step: "accepted" as const,
              joinDeadlineAt: joinMs,
              minimized: false,
            };
          });
          setTrainerIncoming((prev) => {
            if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
            return {
              ...prev,
              step: "accepted",
              joinDeadlineAt: joinMs,
              expiresAt: joinMs,
              minimized: false,
            };
          });
          scheduleExpiry(joinMs, () => {
            setTrainerIncoming(null);
            setTraineeBooking((prev) => {
              if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
              return { ...prev, step: "expired" as const };
            });
          });
        }
        return;
      }

      if (phaseLower === "active" || phaseLower === "completed") {
        setTrainerIncoming((prev) => {
          if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
          return null;
        });
        if (phaseLower === "completed") {
          setTraineeBooking((prev) => {
            if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
            return null;
          });
        }
      }
    };

    const handlePhase = (payload: InstantLessonPhasePayload) => {
      applyPhase(payload);
    };

    const invalidateSessionLists = () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    };

    const handleDecline = (payload: any) => {
      const { lessonId } = payload || {};
      setTraineeBooking((prev) => {
        if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
        return { ...prev, step: "declined" as const, minimized: false };
      });
      invalidateSessionLists();
    };

    const handleExpire = (payload: any) => {
      const { lessonId } = payload || {};
      clearExpiryTimer();
      if (lessonId) void endInstantLessonCall(String(lessonId));
      setTrainerIncoming((prev) => {
        if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
        return null;
      });
      setTraineeBooking((prev) => {
        if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
        return { ...prev, step: "expired" as const };
      });
      invalidateSessionLists();
    };

    const handleTraineeCancelled = (payload: any) => {
      const { lessonId } = payload || {};
      clearExpiryTimer();
      if (lessonId) void endInstantLessonCall(String(lessonId));
      setTrainerIncoming((prev) => {
        if (!prev || String(prev.lessonId) !== String(lessonId)) return prev;
        return null;
      });
    };

    registerInstantLessonHandlers({
      onPhase: applyPhase,
      onIncomingRequest: applyIncomingRequest,
    });

    socket.on(EVENTS.REQUEST, handleRequest);
    socket.on(EVENTS.ACCEPT, handleAccept);
    socket.on(EVENTS.DECLINE, handleDecline);
    socket.on(EVENTS.EXPIRE, handleExpire);
    socket.on(EVENTS.PHASE, handlePhase);
    socket.on(EVENTS.TRAINEE_CANCELLED, handleTraineeCancelled);

    return () => {
      socket.off(EVENTS.REQUEST, handleRequest);
      socket.off(EVENTS.ACCEPT, handleAccept);
      socket.off(EVENTS.DECLINE, handleDecline);
      socket.off(EVENTS.EXPIRE, handleExpire);
      socket.off(EVENTS.PHASE, handlePhase);
      socket.off(EVENTS.TRAINEE_CANCELLED, handleTraineeCancelled);
    };
  }, [socket, clearExpiryTimer, scheduleExpiry, startRinging, queryClient]);

  useEffect(() => {
    if (
      trainerIncoming?.step === "incoming" &&
      !trainerIncoming.minimized &&
      !shouldUseNativeIncomingCallUi()
    ) {
      void startRinging();
      return;
    }
    void stopRinging();
  }, [trainerIncoming?.step, trainerIncoming?.minimized, startRinging, stopRinging]);

  const emitAccept = useCallback(
    (
      lessonId: string,
      coachId: string,
      traineeId: string,
      onOk?: (joinMs: number) => void
    ) => {
      if (!socket) return;
      void stopRinging();
      socket.emit(
        EVENTS.ACCEPT,
        { lessonId, coachId, traineeId },
        (response?: { ok?: boolean; joinDeadlineAt?: string | number }) => {
          if (!response?.ok) return;
          clearExpiryTimer();
          const joinMs = response.joinDeadlineAt
            ? new Date(response.joinDeadlineAt).getTime()
            : Date.now() + INSTANT_JOIN_AFTER_ACCEPT_MS;
          try {
            Vibration.vibrate(ACCEPT_HAPTIC_PATTERN);
          } catch {
            /** ignore */
          }
          onOk?.(joinMs);
        }
      );
    },
    [socket, clearExpiryTimer, stopRinging]
  );

  const acceptRequest = useCallback(() => {
    if (!trainerIncoming || trainerIncoming.step !== "incoming" || !socket) return;
    const { lessonId, coachId, traineeId } = trainerIncoming;
    emitAccept(lessonId, coachId, traineeId, (joinMs) => {
      void dismissInstantLessonIncomingCall(lessonId);
      void endInstantLessonCall(lessonId);
      setTrainerIncoming((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          step: "accepted",
          joinDeadlineAt: joinMs,
          expiresAt: joinMs,
          minimized: false,
        };
      });
      scheduleExpiry(joinMs, () => setTrainerIncoming(null));
    });
  }, [trainerIncoming, socket, emitAccept, scheduleExpiry]);

  const expireRequest = useCallback(() => {
    if (!trainerIncoming || !socket) return;
    if (trainerIncoming.step === "incoming") {
      socket.emit(EVENTS.EXPIRE, {
        lessonId: trainerIncoming.lessonId,
        coachId: trainerIncoming.coachId,
        traineeId: trainerIncoming.traineeId,
      });
    }
    clearExpiryTimer();
    void stopRinging();
    void endInstantLessonCall(String(trainerIncoming.lessonId));
    setTrainerIncoming(null);
  }, [trainerIncoming, socket, clearExpiryTimer, stopRinging]);

  const declineRequest = useCallback(() => {
    if (!trainerIncoming || !socket) return;
    void stopRinging();
    const lid = String(trainerIncoming.lessonId);
    socket.emit(EVENTS.DECLINE, {
      lessonId: trainerIncoming.lessonId,
      coachId: trainerIncoming.coachId,
      traineeId: trainerIncoming.traineeId,
    });
    clearExpiryTimer();
    void dismissInstantLessonIncomingCall(lid);
    void endInstantLessonCall(lid);
    setTrainerIncoming(null);
  }, [trainerIncoming, socket, clearExpiryTimer, stopRinging]);

  const joinTrainerLesson = useCallback(() => {
    if (!trainerIncoming || trainerIncoming.step !== "accepted") return;
    const lid = String(trainerIncoming.lessonId);
    if (trainerAutoMeetingLessonRef.current === lid) return;
    trainerAutoMeetingLessonRef.current = lid;
    clearExpiryTimer();
    void stopRinging();
    onNavigateToMeeting(lid);
    setTrainerIncoming((prev) =>
      prev?.step === "accepted" ? { ...prev, minimized: true } : prev
    );
  }, [trainerIncoming, onNavigateToMeeting, clearExpiryTimer, stopRinging]);

  const minimizeTrainerAccepted = useCallback(() => {
    void stopRinging();
    setTrainerIncoming((prev) =>
      prev?.step === "accepted" ? { ...prev, minimized: true } : prev
    );
  }, [stopRinging]);

  const restoreTrainerAccepted = useCallback(() => {
    setTrainerIncoming((prev) =>
      prev?.step === "accepted" ? { ...prev, minimized: false } : prev
    );
  }, []);

  const restoreTrainerIncoming = useCallback(() => {
    setTrainerIncoming((prev) =>
      prev?.step === "incoming" ? { ...prev, minimized: false } : prev
    );
  }, []);

  const clearTrainerIncoming = useCallback(() => {
    clearExpiryTimer();
    void stopRinging();
    setTrainerIncoming(null);
  }, [clearExpiryTimer, stopRinging]);

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

      scheduleExpiry(acceptDeadlineAt, () => {
        setTraineeBooking((prev) => {
          if (!prev || String(prev.lessonId) !== lessonId) return prev;
          if (prev.step !== "waiting") return prev;
          return { ...prev, step: "expired" as const };
        });
      });
    },
    [socket, userId, user, scheduleExpiry]
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
    clearExpiryTimer();
    setTraineeBooking(null);
  }, [traineeBooking, socket, clearExpiryTimer]);

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
    clearExpiryTimer();
    onNavigateToMeeting(lid);
    setTraineeBooking(null);
  }, [traineeBooking, onNavigateToMeeting, clearExpiryTimer]);

  const focusTrainerRequestFromSession = useCallback(
    (session: Record<string, unknown>) => {
      const lessonId = String(session._id ?? session.id ?? "");
      if (!lessonId) return;

      const traineeInfo = (session.trainee_info ?? {}) as TrainerIncoming["traineeInfo"];
      const base = {
        lessonId,
        coachId: String(session.trainer_id ?? userId),
        traineeId: String(session.trainee_id ?? ""),
        traineeInfo: {
          _id: String(traineeInfo._id ?? session.trainee_id ?? ""),
          fullname: traineeInfo.fullname ?? "Trainee",
          profile_picture: traineeInfo.profile_picture,
        },
        duration: Number(session.duration_minutes) || 30,
        lessonType: `Instant Lesson - ${Number(session.duration_minutes) || 30} min`,
        minimized: false,
      };

      const status = normalizeSessionStatus(session.status as string);
      const instant = isInstantLesson(session);
      const joinRaw = session.join_deadline_at ?? session.joinDeadlineAt;
      const joinMs = joinRaw
        ? new Date(String(joinRaw)).getTime()
        : session.accepted_at
          ? new Date(String(session.accepted_at)).getTime() + INSTANT_JOIN_AFTER_ACCEPT_MS
          : Date.now() + INSTANT_JOIN_AFTER_ACCEPT_MS;

      if (instant && (status === "confirmed" || status === "upcoming") && joinMs > Date.now()) {
        setTrainerIncoming({
          ...base,
          step: "accepted",
          joinDeadlineAt: joinMs,
          expiresAt: joinMs,
        });
        scheduleExpiry(joinMs, () => setTrainerIncoming(null));
        return;
      }

      const acceptRaw = session.accept_deadline_at ?? session.acceptDeadlineAt;
      const acceptMs = acceptRaw
        ? new Date(String(acceptRaw)).getTime()
        : Date.now() + INSTANT_ACCEPT_WINDOW_MS;
      setTrainerIncoming({
        ...base,
        step: "incoming",
        expiresAt: Number.isFinite(acceptMs) ? acceptMs : Date.now() + INSTANT_ACCEPT_WINDOW_MS,
      });
      scheduleExpiry(
        Number.isFinite(acceptMs) ? acceptMs : Date.now() + INSTANT_ACCEPT_WINDOW_MS,
        () => setTrainerIncoming(null)
      );
    },
    [userId, scheduleExpiry]
  );

  const restoreTraineeFlowFromSession = useCallback(
    (session: Record<string, unknown>, step: "waiting" | "accepted") => {
      const lessonId = String(session._id ?? session.id ?? "");
      if (!lessonId) return;

      const coachId = String(session.trainer_id ?? "");
      const traineeId = String(session.trainee_id ?? userId);
      const trainerInfo = (session.trainer_info ?? {}) as { fullname?: string };
      const trainerName = trainerInfo.fullname ?? "Coach";

      const acceptRaw = session.accept_deadline_at ?? session.acceptDeadlineAt;
      const acceptMs = acceptRaw
        ? new Date(String(acceptRaw)).getTime()
        : Date.now() + INSTANT_ACCEPT_WINDOW_MS;

      if (step === "waiting") {
        setTraineeBooking({
          lessonId,
          coachId,
          traineeId,
          trainerName,
          step: "waiting",
          acceptDeadlineAt: acceptMs,
          minimized: false,
        });
        scheduleExpiry(acceptMs, () => {
          setTraineeBooking((prev) => {
            if (!prev || String(prev.lessonId) !== lessonId) return prev;
            return { ...prev, step: "expired" as const };
          });
        });
        return;
      }

      const joinRaw = session.join_deadline_at ?? session.joinDeadlineAt;
      const joinMs = joinRaw
        ? new Date(String(joinRaw)).getTime()
        : session.accepted_at
          ? new Date(String(session.accepted_at)).getTime() + INSTANT_JOIN_AFTER_ACCEPT_MS
          : Date.now() + INSTANT_JOIN_AFTER_ACCEPT_MS;

      setTraineeBooking({
        lessonId,
        coachId,
        traineeId,
        trainerName,
        step: "accepted",
        joinDeadlineAt: joinMs,
        minimized: false,
      });
      scheduleExpiry(joinMs, () => {
        setTraineeBooking((prev) => {
          if (!prev || String(prev.lessonId) !== lessonId) return prev;
          return { ...prev, step: "expired" as const };
        });
      });
    },
    [userId, scheduleExpiry]
  );

  const buildIncomingFromSession = useCallback(
    (session: Record<string, unknown>): InstantLessonIncomingPayload | null => {
      const lessonId = String(session._id ?? session.id ?? "");
      if (!lessonId) return null;
      const traineeInfo = (session.trainee_info ?? {}) as InstantLessonIncomingPayload["traineeInfo"];
      const acceptRaw = session.accept_deadline_at ?? session.acceptDeadlineAt;
      const acceptMs = acceptRaw
        ? new Date(String(acceptRaw)).getTime()
        : Date.now() + INSTANT_ACCEPT_WINDOW_MS;
      return {
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
      };
    },
    [userId]
  );

  const acceptInstantSession = useCallback(
    async (session: Record<string, unknown>) => {
      const lessonId = String(session._id ?? session.id ?? "");
      const coachId = String(session.trainer_id ?? userId);
      const traineeId = String(session.trainee_id ?? "");
      if (!lessonId || !socket) return;
      focusTrainerRequestFromSession(session);
      await new Promise<void>((resolve) => {
        emitAccept(lessonId, coachId, traineeId, (joinMs) => {
          setTrainerIncoming((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              step: "accepted",
              joinDeadlineAt: joinMs,
              expiresAt: joinMs,
              minimized: false,
            };
          });
          scheduleExpiry(joinMs, () => setTrainerIncoming(null));
          resolve();
        });
      });
    },
    [socket, userId, focusTrainerRequestFromSession, emitAccept, scheduleExpiry]
  );

  const declineInstantSession = useCallback(
    async (session: Record<string, unknown>) => {
      const lessonId = String(session._id ?? session.id ?? "");
      const coachId = String(session.trainer_id ?? userId);
      const traineeId = String(session.trainee_id ?? "");
      if (!lessonId || !socket) return;
      void stopRinging();
      socket.emit(EVENTS.DECLINE, { lessonId, coachId, traineeId });
      clearExpiryTimer();
      void dismissInstantLessonIncomingCall(lessonId);
      void endInstantLessonCall(lessonId);
      setTrainerIncoming(null);
    },
    [socket, userId, stopRinging, clearExpiryTimer]
  );

  const acceptIncomingPayload = useCallback(
    async (payload: InstantLessonIncomingPayload) => {
      await acceptInstantSession({
        _id: payload.lessonId,
        trainer_id: payload.coachId,
        trainee_id: payload.traineeId,
        trainee_info: payload.traineeInfo,
        duration_minutes: payload.duration,
      });
    },
    [acceptInstantSession]
  );

  const declineIncomingPayload = useCallback(
    async (payload: InstantLessonIncomingPayload) => {
      setTrainerIncoming({
        lessonId: payload.lessonId,
        coachId: payload.coachId,
        traineeId: payload.traineeId,
        traineeInfo: payload.traineeInfo,
        expiresAt: payload.expiresAt,
        step: "incoming",
        minimized: false,
        duration: payload.duration,
        lessonType: payload.lessonType,
      });
      await declineInstantSession({
        _id: payload.lessonId,
        trainer_id: payload.coachId,
        trainee_id: payload.traineeId,
      });
    },
    [declineInstantSession]
  );

  useEffect(() => {
    registerInstantLessonActionHandlers({
      acceptIncoming: acceptIncomingPayload,
      declineIncoming: async (lessonId) => {
        const built = buildIncomingFromSession({ _id: lessonId });
        if (built) await declineIncomingPayload(built);
      },
    });
    return () => registerInstantLessonActionHandlers({});
  }, [acceptIncomingPayload, declineIncomingPayload, buildIncomingFromSession]);

  useEffect(() => {
    void (async () => {
      const pending = await consumeInstantLessonNotificationAction();
      if (!pending) return;
      if (pending.action === "INSTANT_LESSON_ACCEPT") {
        await acceptIncomingPayload(pending.payload);
      } else if (pending.action === "INSTANT_LESSON_DECLINE") {
        await declineIncomingPayload(pending.payload);
      }
    })();
  }, [acceptIncomingPayload, declineIncomingPayload]);

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
      joinTrainerLesson,
      minimizeTrainerAccepted,
      restoreTrainerAccepted,
      restoreTrainerIncoming,
      clearTrainerIncoming,
      focusTrainerRequestFromSession,
      restoreTraineeFlowFromSession,
      acceptInstantSession,
      declineInstantSession,
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
      joinTrainerLesson,
      minimizeTrainerAccepted,
      restoreTrainerAccepted,
      restoreTrainerIncoming,
      clearTrainerIncoming,
      focusTrainerRequestFromSession,
      restoreTraineeFlowFromSession,
      acceptInstantSession,
      declineInstantSession,
    ]
  );

  return <InstantLessonContext.Provider value={value}>{children}</InstantLessonContext.Provider>;
}

export function useInstantLesson(): InstantLessonContextValue {
  return useContext(InstantLessonContext);
}
