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
import { useAuth } from "../auth/context/AuthContext";
import { fetchNotifications, patchNotificationsMarkRead } from "../home/api/homeApi";
import { useSocket } from "../socket/SocketContext";

/**
 * Centralised in-app notification system. Web parity with
 * `nq-frontend-main/app/components/notifications-service/*` and
 * `nq-frontend-main/app/components/notification-popup/index.jsx`:
 *
 *   • Backend socket events live on `EVENTS.PUSH_NOTIFICATIONS` (see
 *     `nq-backend-main/src/config/constance.ts`):
 *       - `'send'`     — client → server. Triggers persistence (`notifications.create`)
 *                        and a re-emit on the receiver's socket. Payload shape:
 *                        `{ title, description, senderId, receiverId, bookingInfo?, type? }`.
 *       - `'receive'`  — server → client. Single notification doc the receiver should
 *                        merge into its inbox.
 *
 *   • REST inbox lives on `/notifications` (`GET` list, `PATCH /update` mark-read).
 *
 * This provider keeps the cached inbox fresh, drives an in-app toast for every push,
 * and exposes `emitNotification()` so any screen can trigger a notification the same
 * way the website does.
 */

export const NOTIFICATION_TITLES = {
  newBookingRequest: "New Booking Request",
  sessionConfirmation: "Session Confirmation",
  sessionStarted: "Session Started",
  sessionCancellation: "Session Cancellation",
  feedbackReceived: "Feedback Received",
  friendRequestReceived: "Received Friend Request",
  gamePlanReport: "Game Plan Report",
} as const;

export const NOTIFICATION_TYPES = {
  /** Keep these strings byte-identical to web `utils/constant.js` / backend `notification.enum`. */
  DEFAULT: "Default",
  PROMOTIONAL: "Promotional",
  TRANSCATIONAL: "Transcational",
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export type IncomingNotification = {
  _id?: string;
  title: string;
  description?: string;
  /** Server timestamp. */
  createdAt?: string;
  isRead?: boolean;
  /** Web shape after backend re-emit. */
  sender?: {
    _id?: string;
    name?: string;
    profile_picture?: string | null;
  };
  /** Optional metadata that helps the receiver render a CTA / refetch a slice. */
  bookingInfo?: any;
  type?: NotificationType;
};

export type EmitNotificationPayload = {
  title: string;
  description: string;
  /** Receiver's user `_id`. */
  receiverId: string;
  /** Optional — defaults to the current user's `_id` from auth context. */
  senderId?: string;
  type?: NotificationType;
  bookingInfo?: any;
};

type NotificationContextValue = {
  /** Unread count derived from the REST cache. */
  unreadCount: number;
  /** The newest in-memory push received this session. Used by `NotificationToast`. */
  latestToast: IncomingNotification | null;
  /** Dismiss the floating toast (does NOT mark anything read server-side). */
  dismissToast: () => void;
  /**
   * Web-parity helper: emit `'send'` on the socket with the same payload shape the
   * website uses, so the backend persists + re-emits to the receiver.
   */
  emitNotification: (payload: EmitNotificationPayload) => boolean;
  /** Force a refetch of the inbox + refresh the unread badge. */
  refreshInbox: () => Promise<void>;
  /**
   * Mark the first page of notifications as read (mirrors the web behaviour of marking
   * page-1 read whenever the user opens the inbox).
   */
  markFirstPageRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const SOCKET_EVENT_SEND = "send";
const SOCKET_EVENT_RECEIVE = "receive";

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const { user, status } = useAuth();
  const { socket } = useSocket();

  const [latestToast, setLatestToast] = useState<IncomingNotification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  /** Keep the auth user id in a ref so socket callbacks always see the latest value. */
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = (user?._id as string) ?? null;

  const refreshInbox = useCallback(async () => {
    if (status !== "signedIn") return;
    try {
      const list = await fetchNotifications(1, 50);
      queryClient.setQueryData(["notifications"], list);
      const unread = list.filter(
        (n: any) => !(n?.isRead ?? n?.is_read ?? false)
      ).length;
      setUnreadCount(unread);
    } catch {
      /** non-blocking */
    }
  }, [queryClient, status]);

  const markFirstPageRead = useCallback(async () => {
    try {
      await patchNotificationsMarkRead(1);
    } finally {
      await refreshInbox();
    }
  }, [refreshInbox]);

  /** Pull the inbox once on sign-in + on a coarse interval so badges stay reasonably current. */
  useEffect(() => {
    if (status !== "signedIn") {
      setUnreadCount(0);
      setLatestToast(null);
      return;
    }
    void refreshInbox();
    const id = setInterval(() => {
      void refreshInbox();
    }, 60_000);
    return () => clearInterval(id);
  }, [status, refreshInbox]);

  /** Listen to live pushes. */
  useEffect(() => {
    if (!socket) return;

    const onReceive = (payload: IncomingNotification) => {
      if (!payload || !payload.title) return;

      /** Mirror the web reducer: prepend to cache so the inbox stays sorted by recency. */
      queryClient.setQueryData<IncomingNotification[]>(
        ["notifications"],
        (prev) => {
          const list = prev ?? [];
          /** De-dupe by `_id` — backend may re-deliver on reconnect. */
          if (payload._id && list.some((n) => n._id === payload._id)) return list;
          return [{ ...payload, isRead: false }, ...list];
        }
      );

      setUnreadCount((c) => c + 1);
      setLatestToast({ ...payload, isRead: false });

      /**
       * Side-effects driven by the notification *title* — same approach as web
       * `NavHomePage`: re-fetch the bookings list when a booking-related notification
       * arrives, so the upcoming/confirmed tabs auto-refresh.
       */
      const t = payload.title?.toLowerCase() ?? "";
      if (
        t.includes("booking") ||
        t.includes("session") ||
        t.includes("confirm")
      ) {
        queryClient.invalidateQueries({ queryKey: ["scheduledMeetings"] });
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
      }
      if (t.includes("friend")) {
        queryClient.invalidateQueries({ queryKey: ["friends"] });
        queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      }
    };

    socket.on(SOCKET_EVENT_RECEIVE, onReceive);
    return () => {
      socket.off(SOCKET_EVENT_RECEIVE, onReceive);
    };
  }, [socket, queryClient]);

  const emitNotification = useCallback(
    (payload: EmitNotificationPayload): boolean => {
      if (!socket || !socket.connected) {
        if (__DEV__) {
          console.warn(
            "[notifications] socket not connected — cannot emit",
            payload.title
          );
        }
        return false;
      }
      const senderId = payload.senderId ?? userIdRef.current ?? undefined;
      if (!senderId) return false;
      socket.emit(SOCKET_EVENT_SEND, {
        title: payload.title,
        description: payload.description,
        senderId,
        receiverId: payload.receiverId,
        type: payload.type ?? NOTIFICATION_TYPES.DEFAULT,
        bookingInfo: payload.bookingInfo,
      });
      return true;
    },
    [socket]
  );

  const dismissToast = useCallback(() => setLatestToast(null), []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      unreadCount,
      latestToast,
      dismissToast,
      emitNotification,
      refreshInbox,
      markFirstPageRead,
    }),
    [
      unreadCount,
      latestToast,
      dismissToast,
      emitNotification,
      refreshInbox,
      markFirstPageRead,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
