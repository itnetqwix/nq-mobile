import { useEffect } from "react";
import { socketCacheEvent } from "../../store/actions/cacheInvalidation";
import { useAppDispatch } from "../../store/hooks";
import {
  SOCKET_PRESENCE_EVENTS,
  SOCKET_SESSION_EVENTS,
  SOCKET_WALLET_EVENTS,
} from "../../lib/socketInvalidate";
import { useSocket } from "./SocketContext";

const BOOKING_EVENTS = [
  "BOOKING_CREATED",
  "BOOKING_UPDATED",
  "BOOKING_STATUS_UPDATED",
  "BOOKING_CANCELLED",
] as const;

const ALL_INVALIDATION_EVENTS = [
  ...SOCKET_SESSION_EVENTS,
  ...BOOKING_EVENTS,
  ...SOCKET_WALLET_EVENTS,
  ...SOCKET_PRESENCE_EVENTS,
  "INSTANT_LESSON_PHASE",
  "receive",
] as const;

/**
 * Dispatches RTK cache-invalidation actions on socket events.
 * `queryCacheListenerMiddleware` applies React Query invalidations.
 */
export function SocketQueryInvalidationBridge() {
  const { socket } = useSocket();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!socket) return;

    const handler = (event: string) => {
      dispatch(socketCacheEvent({ event }));
    };

    ALL_INVALIDATION_EVENTS.forEach((event) => {
      socket.on(event, handler);
    });

    return () => {
      ALL_INVALIDATION_EVENTS.forEach((event) => {
        socket.off(event, handler);
      });
    };
  }, [socket, dispatch]);

  return null;
}
