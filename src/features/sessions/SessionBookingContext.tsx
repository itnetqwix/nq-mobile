import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccountType } from "../../constants/accountType";
import { useAuth } from "../auth/context/AuthContext";
import { fetchScheduledMeetings } from "../home/api/homeApi";
import { isPendingBooking } from "../../lib/sessions/sessionUtils";
import { NOTIFICATION_TITLES } from "../notifications/NotificationContext";
import { useSocket } from "../socket/SocketContext";
import { SessionActionModal } from "./SessionActionModal";

type SessionBookingContextValue = {
  openSession: (session: any) => void;
  closeSession: () => void;
  activeSession: any | null;
  pendingSessions: any[];
  refreshPending: () => Promise<void>;
};

const SessionBookingContext = createContext<SessionBookingContextValue | null>(null);

export function SessionBookingProvider({ children }: { children: React.ReactNode }) {
  const { accountType, status } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const isTrainer = accountType === AccountType.TRAINER;

  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [pendingSessions, setPendingSessions] = useState<any[]>([]);
  const lastPopupIdRef = useRef<string | null>(null);

  const refreshPending = useCallback(async () => {
    if (status !== "signedIn" || !isTrainer) {
      setPendingSessions([]);
      return;
    }
    try {
      const rows = await fetchScheduledMeetings("upcoming");
      setPendingSessions(rows.filter(isPendingBooking));
    } catch {
      setPendingSessions([]);
    }
  }, [status, isTrainer]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  const openSession = useCallback((session: any) => {
    if (!session) return;
    /** Manual opens (locker / upcoming list) should always work. */
    lastPopupIdRef.current = null;
    setActiveSession(session);
  }, []);

  const closeSession = useCallback(() => {
    setActiveSession(null);
  }, []);

  const tryOpenFromBookingEvent = useCallback(
    async (bookingId?: string) => {
      if (!isTrainer) return;
      await refreshPending();
      const rows = await fetchScheduledMeetings("upcoming");
      const pending = rows.filter(isPendingBooking);
      setPendingSessions(pending);

      const match = bookingId
        ? pending.find((s) => String(s._id) === String(bookingId)) ??
          rows.find((s) => String(s._id) === String(bookingId))
        : pending[0];

      if (!match) return;
      const id = String(match._id);
      if (lastPopupIdRef.current === id) return;
      lastPopupIdRef.current = id;
      setActiveSession(match);
    },
    [isTrainer, refreshPending]
  );

  useEffect(() => {
    if (!socket || !isTrainer) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      void refreshPending();
    };

    const onBookingCreated = (data: { bookingId?: string }) => {
      invalidate();
      void tryOpenFromBookingEvent(data?.bookingId);
    };

    const onBookingStatusUpdated = () => {
      invalidate();
    };

    const onReceive = (payload: { title?: string; bookingInfo?: any }) => {
      if (payload?.title !== NOTIFICATION_TITLES.newBookingRequest) return;
      invalidate();
      const bookingId = payload?.bookingInfo?._id ?? payload?.bookingInfo?.id;
      void tryOpenFromBookingEvent(bookingId ? String(bookingId) : undefined);
    };

    socket.on("BOOKING_CREATED", onBookingCreated);
    socket.on("BOOKING_STATUS_UPDATED", onBookingStatusUpdated);
    socket.on("receive", onReceive);

    return () => {
      socket.off("BOOKING_CREATED", onBookingCreated);
      socket.off("BOOKING_STATUS_UPDATED", onBookingStatusUpdated);
      socket.off("receive", onReceive);
    };
  }, [socket, isTrainer, queryClient, refreshPending, tryOpenFromBookingEvent]);

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
