import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  invalidateForSocketEvent,
  SOCKET_SESSION_EVENTS,
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
  "INSTANT_LESSON_PHASE",
  "userStatus",
  "onlineUser",
] as const;

/**
 * Keeps React Query caches fresh when the server pushes booking/timer/extension updates.
 */
export function SocketQueryInvalidationBridge() {
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handler = (event: string) => {
      invalidateForSocketEvent(queryClient, event);
    };

    ALL_INVALIDATION_EVENTS.forEach((event) => {
      socket.on(event, handler);
    });

    return () => {
      ALL_INVALIDATION_EVENTS.forEach((event) => {
        socket.off(event, handler);
      });
    };
  }, [socket, queryClient]);

  return null;
}
