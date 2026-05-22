import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSocket } from "./SocketContext";

const SESSION_INVALIDATION_EVENTS = [
  "LESSON_TIMER_EXTENDED",
  "SESSION_EXTENSION_APPLIED",
  "SESSION_EXTENSION_REQUESTED",
  "SESSION_EXTENSION_ACCEPTED",
  "SESSION_EXTENSION_REJECTED",
  "SESSION_EXTENSION_CANCELLED",
  "SESSION_EXTENSION_EXPIRED",
  "BOOKING_CREATED",
  "BOOKING_UPDATED",
  "BOOKING_CANCELLED",
] as const;

/**
 * Keeps React Query session lists fresh when the server pushes booking/timer updates.
 */
export function SocketQueryInvalidationBridge() {
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const invalidateSessions = () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    };

    SESSION_INVALIDATION_EVENTS.forEach((event) => {
      socket.on(event, invalidateSessions);
    });

    return () => {
      SESSION_INVALIDATION_EVENTS.forEach((event) => {
        socket.off(event, invalidateSessions);
      });
    };
  }, [socket, queryClient]);

  return null;
}
