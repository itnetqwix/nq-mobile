import { useEffect, useState, useCallback } from "react";
import { useSocket } from "./SocketContext";

/** Tracks user ids currently online via socket `userStatus` / `onlineUser` events. */
export function useOnlinePresence() {
  const { socket } = useSocket();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());

  const ingestActiveUsers = useCallback((activeUsers: Record<string, unknown> | undefined) => {
    if (!activeUsers || typeof activeUsers !== "object") return;
    setOnlineIds(new Set(Object.keys(activeUsers).map(String)));
  }, []);

  useEffect(() => {
    if (!socket) {
      setOnlineIds(new Set());
      return;
    }

    const onOnlineUser = (data: { user?: Record<string, unknown> }) => {
      ingestActiveUsers(data?.user);
    };

    const onUserStatus = (data: {
      userId?: string;
      status?: string;
      user?: Record<string, unknown>;
    }) => {
      if (data?.user) ingestActiveUsers(data.user);
      else if (data?.userId) {
        setOnlineIds((prev) => {
          const next = new Set(prev);
          if (data.status === "online") next.add(String(data.userId));
          else next.delete(String(data.userId));
          return next;
        });
      }
    };

    socket.on("onlineUser", onOnlineUser);
    socket.on("userStatus", onUserStatus);

    return () => {
      socket.off("onlineUser", onOnlineUser);
      socket.off("userStatus", onUserStatus);
    };
  }, [socket, ingestActiveUsers]);

  const isOnline = useCallback((userId?: string | null) => {
    if (!userId) return false;
    return onlineIds.has(String(userId));
  }, [onlineIds]);

  return { onlineIds, isOnline };
}
