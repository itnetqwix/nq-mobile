import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { AccountType } from "../../constants/accountType";
import { useAuth } from "../auth/context/AuthContext";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  setActiveSession,
  setPendingSessions,
} from "../../store/slices/sessionBookingSlice";
import {
  selectActiveBookingSession,
  selectPendingBookingSessions,
} from "../../store/selectors";
import { fetchScheduledMeetings } from "../home/api/homeApi";
import { shouldOpenTrainerScheduledBookingPopup } from "../../lib/booking/bookingWizardValidation";
import {
  extractBookingIdFromNotification,
  isNewBookingNotificationTitle,
  shouldShowInDashboardRequests,
} from "../../lib/sessions/sessionUtils";
import { queryKeys } from "../../lib/queryKeys";
import { useSocket } from "../socket/SocketContext";
import { SessionActionModal } from "./SessionActionModal";

const POLL_MS = 120_000;
const OPEN_RETRY_DELAYS_MS = [0, 500, 1200, 2500];
const PENDING_FETCH_COOLDOWN_MS = 45_000;

type SessionBookingContextValue = {
  openSession: (session: any) => void;
  closeSession: () => void;
  activeSession: any | null;
  pendingSessions: any[];
  refreshPending: () => Promise<void>;
};

const SessionBookingContext = createContext<SessionBookingContextValue | null>(null);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function SessionBookingProvider({ children }: { children: React.ReactNode }) {
  const { accountType, status } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const isTrainer = accountType === AccountType.TRAINER;

  const dispatch = useAppDispatch();
  const activeSession = useAppSelector(selectActiveBookingSession);
  const pendingSessions = useAppSelector(selectPendingBookingSessions);
  const lastPopupIdRef = useRef<string | null>(null);
  const knownPendingIdsRef = useRef<Set<string>>(new Set());
  const pendingSeededRef = useRef(false);
  const lastPendingFetchRef = useRef(0);

  const loadPending = useCallback(
    async (force = false) => {
      if (status !== "signedIn" || !isTrainer) {
        dispatch(setPendingSessions([]));
        return [];
      }
      const now = Date.now();
      if (!force && now - lastPendingFetchRef.current < PENDING_FETCH_COOLDOWN_MS) {
        const cached = queryClient.getQueryData<any[]>(queryKeys.sessions.upcoming);
        if (Array.isArray(cached)) {
          const pending = cached.filter((s) => shouldShowInDashboardRequests(s));
          dispatch(setPendingSessions(pending));
          return pending;
        }
      }

      try {
        const rows = await queryClient.fetchQuery({
          queryKey: queryKeys.sessions.upcoming,
          queryFn: () => fetchScheduledMeetings("upcoming"),
          staleTime: PENDING_FETCH_COOLDOWN_MS,
        });
        lastPendingFetchRef.current = Date.now();
        const pending = rows.filter((s) => shouldShowInDashboardRequests(s));
        dispatch(setPendingSessions(pending));
        return pending;
      } catch {
        dispatch(setPendingSessions([]));
        return [];
      }
    },
    [status, isTrainer, dispatch, queryClient]
  );

  const refreshPending = useCallback(async () => {
    await loadPending(true);
  }, [loadPending]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  const openSession = useCallback((session: any) => {
    if (!session) return;
    lastPopupIdRef.current = null;
    dispatch(setActiveSession(session));
  }, [dispatch]);

  const closeSession = useCallback(() => {
    dispatch(setActiveSession(null));
  }, [dispatch]);

  const showSessionModal = useCallback((session: any) => {
    if (!session) return;
    const id = String(session._id ?? session.id ?? "");
    if (!id) return;
    lastPopupIdRef.current = id;
    dispatch(setActiveSession(session));
  }, [dispatch]);

  const tryOpenFromBookingEvent = useCallback(
    async (bookingId?: string) => {
      if (!isTrainer) return;

      for (const delay of OPEN_RETRY_DELAYS_MS) {
        if (delay > 0) await sleep(delay);
        const pending = await loadPending(true);

        const cachedUpcoming =
          queryClient.getQueryData<any[]>(queryKeys.sessions.upcoming) ?? pending;
        const match = bookingId
          ? pending.find((s) => String(s._id) === String(bookingId)) ??
            cachedUpcoming.find((s) => String(s._id) === String(bookingId))
          : pending[0];

        if (
          shouldOpenTrainerScheduledBookingPopup(
            match,
            !!match && shouldShowInDashboardRequests(match)
          )
        ) {
          knownPendingIdsRef.current.add(String(match._id));
          showSessionModal(match);
          return;
        }
      }
    },
    [isTrainer, loadPending, showSessionModal, queryClient]
  );

  /** Detect new pending bookings while the app is open (socket may be offline). */
  const syncPendingPopups = useCallback(async () => {
    if (!isTrainer || status !== "signedIn") return;
    const pending = await loadPending();
    const ids = pending.map((s) => String(s._id));

    if (!pendingSeededRef.current) {
      ids.forEach((id) => knownPendingIdsRef.current.add(id));
      pendingSeededRef.current = true;
      const firstScheduled = pending.find((s) =>
        shouldOpenTrainerScheduledBookingPopup(s, shouldShowInDashboardRequests(s))
      );
      if (firstScheduled) {
        showSessionModal(firstScheduled);
      }
      return;
    }

    for (const session of pending) {
      if (
        !shouldOpenTrainerScheduledBookingPopup(
          session,
          shouldShowInDashboardRequests(session)
        )
      ) {
        continue;
      }
      const id = String(session._id);
      if (!knownPendingIdsRef.current.has(id)) {
        knownPendingIdsRef.current.add(id);
        showSessionModal(session);
        break;
      }
    }
  }, [isTrainer, status, loadPending, showSessionModal]);

  useEffect(() => {
    if (!isTrainer || status !== "signedIn") {
      pendingSeededRef.current = false;
      knownPendingIdsRef.current.clear();
      return;
    }

    void syncPendingPopups();
    const pollId = setInterval(() => {
      void syncPendingPopups();
    }, POLL_MS);

    const onAppState = (next: AppStateStatus) => {
      if (next === "active") void syncPendingPopups();
    };
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      clearInterval(pollId);
      sub.remove();
    };
  }, [isTrainer, status, syncPendingPopups]);

  useEffect(() => {
    if (!socket || !isTrainer) return;

    const refreshBookingUi = () => {
      void refreshPending();
    };

    const onBookingCreated = (data: { bookingId?: string; trainerId?: string }) => {
      refreshBookingUi();
      void tryOpenFromBookingEvent(data?.bookingId);
    };

    const onBookingStatusUpdated = () => {
      refreshBookingUi();
    };

    const onReceive = (payload: { title?: string; bookingInfo?: Record<string, unknown> }) => {
      if (!isNewBookingNotificationTitle(payload?.title)) return;
      refreshBookingUi();
      const bookingId = extractBookingIdFromNotification(payload);
      void tryOpenFromBookingEvent(bookingId);
    };

    socket.on("BOOKING_CREATED", onBookingCreated);
    socket.on("BOOKING_STATUS_UPDATED", onBookingStatusUpdated);
    socket.on("receive", onReceive);

    return () => {
      socket.off("BOOKING_CREATED", onBookingCreated);
      socket.off("BOOKING_STATUS_UPDATED", onBookingStatusUpdated);
      socket.off("receive", onReceive);
    };
  }, [socket, isTrainer, refreshPending, tryOpenFromBookingEvent]);

  const value = useMemo(
    () => ({
      openSession,
      closeSession,
      activeSession,
      pendingSessions,
      refreshPending,
    }),
    [openSession, closeSession, activeSession, pendingSessions, refreshPending]
  );

  return (
    <SessionBookingContext.Provider value={value}>
      {children}
      <SessionActionModal
        visible={!!activeSession}
        session={activeSession}
        onClose={closeSession}
        onSessionUpdated={(session) => dispatch(setActiveSession(session))}
      />
    </SessionBookingContext.Provider>
  );
}

export function useSessionBooking(): SessionBookingContextValue {
  const ctx = useContext(SessionBookingContext);
  if (!ctx) {
    throw new Error("useSessionBooking must be used within SessionBookingProvider");
  }
  return ctx;
}
