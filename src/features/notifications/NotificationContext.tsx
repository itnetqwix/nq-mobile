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
import { emitInstantLessonPhase } from "../instant-lesson/instantLessonBridge";
import { navigationRef } from "../../navigation/navigationRef";

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
  /** New: lifecycle coverage for the in-call experience + locker activity. */
  peerJoinedCall: "User Joined",
  peerLeftCall: "User Left",
  fiveMinutesRemaining: "5 Minutes Left",
  oneMinuteRemaining: "1 Minute Left",
  sessionEnded: "Session Ended",
  clipShared: "Clip Shared",
  bookingReminder: "Session Reminder",
  instantLessonAccepted: "Instant lesson accepted",
  instantLessonDeclined: "Instant lesson declined",
  instantLessonExpired: "Instant lesson expired",
  instantLessonJoinExpired: "Lesson did not start",
  refundProcessed: "Refund processed",
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
  /** True for client-only toasts that never hit the backend (peer joined,
   *  timer warning, etc.). They show in the toast stack but are not persisted
   *  to the REST inbox. */
  isLocalOnly?: boolean;
};

/** Lightweight payload accepted by `pushLocalToast`. */
export type LocalToastPayload = {
  title: string;
  description?: string;
  /** Optional sender block — purely for the toast avatar / inbox row UI. */
  sender?: IncomingNotification["sender"];
  bookingInfo?: any;
  type?: NotificationType;
  /** When true, the toast is also prepended to the in-memory inbox cache so it
   *  surfaces in the NotificationsScreen list until the next REST refresh
   *  replaces it. Default: false (toast-only). */
  persistInInbox?: boolean;
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
  /** Up to 3 most recent notifications waiting to be shown by the toast stack. */
  toastQueue: IncomingNotification[];
  /** Backwards-compatible alias for the head of the toast queue. */
  latestToast: IncomingNotification | null;
  /** Dismiss a single toast by id (or the head when no id is supplied). */
  dismissToast: (id?: string) => void;
  /** Clear every queued toast at once (e.g. when the user enters a meeting). */
  clearToasts: () => void;
  /**
   * Web-parity helper: emit `'send'` on the socket with the same payload shape the
   * website uses, so the backend persists + re-emits to the receiver.
   */
  emitNotification: (payload: EmitNotificationPayload) => boolean;
  /**
   * Client-only notification — show a toast (and optionally persist it in the
   * in-memory inbox cache) without round-tripping through the backend. Used for
   * lifecycle moments that never need a sender (peer joined the call, lesson
   * timer warning, …).
   */
  pushLocalToast: (payload: LocalToastPayload) => void;
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
  const { user, status, accountType } = useAuth();
  const { socket } = useSocket();

  const [toastQueue, setToastQueue] = useState<IncomingNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const TOAST_STACK_LIMIT = 3;
  const TOAST_DEDUPE_MS = 90_000;
  const recentToastKeysRef = useRef<Map<string, number>>(new Map());

  const toastFingerprint = useCallback((n: IncomingNotification) => {
    const bid =
      n.bookingInfo?.bookingId ??
      n.bookingInfo?.lessonId ??
      n.bookingInfo?.booking_id ??
      "";
    const kind = n.bookingInfo?.kind ?? "";
    return `${n.title}:${kind}:${bid}`;
  }, []);

  /** Generate a stable id for client-only toasts (which never come back with
   *  a server `_id`). Used as the React key + dismiss handle. */
  const localToastSeqRef = useRef(0);
  const mintLocalToastId = useCallback(() => {
    localToastSeqRef.current += 1;
    return `local-${Date.now()}-${localToastSeqRef.current}`;
  }, []);

  const pushToQueue = useCallback((next: IncomingNotification) => {
    const fp = toastFingerprint(next);
    const now = Date.now();
    const last = recentToastKeysRef.current.get(fp);
    if (last && now - last < TOAST_DEDUPE_MS) {
      return;
    }
    recentToastKeysRef.current.set(fp, now);

    setToastQueue((prev) => {
      /** Drop earlier toasts that share the same _id to prevent flicker
       *  duplicates from a reconnecting socket. */
      const without = next._id
        ? prev.filter((t) => t._id !== next._id)
        : prev;
      const merged = [...without, next];
      /** Trim to the configured max so the stack never runs off-screen. */
      return merged.slice(-TOAST_STACK_LIMIT);
    });
  }, [toastFingerprint]);

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
      setToastQueue([]);
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

      let isNewInInbox = true;
      /** Mirror the web reducer: prepend to cache so the inbox stays sorted by recency. */
      queryClient.setQueryData<IncomingNotification[]>(
        ["notifications"],
        (prev) => {
          const list = prev ?? [];
          /** De-dupe by `_id` — backend may re-deliver on reconnect. */
          if (payload._id && list.some((n) => n._id === payload._id)) {
            isNewInInbox = false;
            return list;
          }
          return [{ ...payload, isRead: false }, ...list];
        }
      );

      if (isNewInInbox) {
        setUnreadCount((c) => c + 1);
        pushToQueue({ ...payload, isRead: false });
      }

      const bookingInfo = (payload.bookingInfo ?? {}) as Record<string, unknown>;
      const kind = String(bookingInfo.kind ?? "").toLowerCase();
      const lessonId = String(
        bookingInfo.lessonId ?? bookingInfo.bookingId ?? bookingInfo.booking_id ?? ""
      );
      const titleLower = payload.title?.toLowerCase() ?? "";

      const isTraineeAccount = accountType === "Trainee";
      if (
        isTraineeAccount &&
        (kind === "instant_lesson_accepted" ||
          titleLower.includes("instant lesson accepted"))
      ) {
        if (lessonId && navigationRef.isReady()) {
          (navigationRef as { navigate: (name: string, params: object) => void }).navigate(
            "Meeting",
            { lessonId }
          );
        }
      } else if (
        kind === "instant_lesson_request" ||
        titleLower.includes("instant lesson request")
      ) {
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
      } else if (
        kind === "instant_lesson_declined" ||
        kind === "instant_lesson_join_expired" ||
        kind === "instant_lesson_accept_expired"
      ) {
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
      }

      /**
       * Side-effects driven by the notification *title* — same approach as web
       * `NavHomePage`: re-fetch the bookings list when a booking-related notification
       * arrives, so the upcoming/confirmed tabs auto-refresh.
       */
      const t = payload.title?.toLowerCase() ?? "";
      if (
        t.includes("booking") ||
        t.includes("session") ||
        t.includes("confirm") ||
        t.includes("instant") ||
        t.includes("refund") ||
        t.includes("lesson")
      ) {
        queryClient.invalidateQueries({ queryKey: ["scheduledMeetings"] });
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
      }
      if (t.includes("friend")) {
        queryClient.invalidateQueries({ queryKey: ["friends"] });
        queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      }
    };

    socket.on(SOCKET_EVENT_RECEIVE, onReceive);

    const onBookingCreated = (data: {
      bookingId?: string;
      trainerId?: string;
      traineeId?: string;
      type?: string;
    }) => {
      queryClient.invalidateQueries({ queryKey: ["scheduledMeetings"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["sessions", "upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["trainerAvailability"] });
    };
    const onBookingStatusUpdated = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["scheduledMeetings"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["trainerAvailability"] });
    };

    const onInstantPhase = (data: {
      lessonId?: string;
      phase?: string;
      refundReason?: string;
    }) => {
      emitInstantLessonPhase(data);
      queryClient.invalidateQueries({ queryKey: ["scheduledMeetings"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    };

    socket.on("BOOKING_CREATED", onBookingCreated);
    socket.on("BOOKING_STATUS_UPDATED", onBookingStatusUpdated);
    socket.on("INSTANT_LESSON_PHASE", onInstantPhase);

    return () => {
      socket.off(SOCKET_EVENT_RECEIVE, onReceive);
      socket.off("BOOKING_CREATED", onBookingCreated);
      socket.off("BOOKING_STATUS_UPDATED", onBookingStatusUpdated);
      socket.off("INSTANT_LESSON_PHASE", onInstantPhase);
    };
  }, [socket, queryClient, pushToQueue]);

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

  const dismissToast = useCallback((id?: string) => {
    setToastQueue((prev) => {
      if (prev.length === 0) return prev;
      if (!id) return prev.slice(1);
      return prev.filter((t) => t._id !== id);
    });
  }, []);

  const clearToasts = useCallback(() => setToastQueue([]), []);

  const pushLocalToast = useCallback(
    (payload: LocalToastPayload) => {
      const senderId = userIdRef.current ?? undefined;
      const localId = mintLocalToastId();
      const next: IncomingNotification = {
        _id: localId,
        title: payload.title,
        description: payload.description,
        createdAt: new Date().toISOString(),
        isRead: false,
        sender: payload.sender,
        bookingInfo: payload.bookingInfo,
        type: payload.type ?? NOTIFICATION_TYPES.DEFAULT,
        isLocalOnly: true,
      };
      pushToQueue(next);
      if (payload.persistInInbox) {
        queryClient.setQueryData<IncomingNotification[]>(
          ["notifications"],
          (prev) => {
            const list = prev ?? [];
            return [next, ...list];
          }
        );
        setUnreadCount((c) => c + 1);
      }
      if (__DEV__ && !senderId) {
        // no-op — local toasts are valid even without a signed-in user
      }
    },
    [pushToQueue, queryClient, mintLocalToastId]
  );

  const latestToast = toastQueue.length > 0 ? toastQueue[toastQueue.length - 1] : null;

  const value = useMemo<NotificationContextValue>(
    () => ({
      unreadCount,
      toastQueue,
      latestToast,
      dismissToast,
      clearToasts,
      emitNotification,
      pushLocalToast,
      refreshInbox,
      markFirstPageRead,
    }),
    [
      unreadCount,
      toastQueue,
      latestToast,
      dismissToast,
      clearToasts,
      emitNotification,
      pushLocalToast,
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
