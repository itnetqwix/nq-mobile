import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "../auth/context/AuthContext";
import { API_BASE_URL } from "../../config/env";
import { getAccessToken } from "../auth/session/tokenStorage";

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextValue>({ socket: null, isConnected: false });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (status !== "signedIn") {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      setIsConnected(false);
      return;
    }

    let cancelled = false;
    let createdSocket: Socket | null = null;

    (async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;

      /**
       * Must match web `app/components/socket/index.jsx`: JWT in **query** `authorization`.
       * `nq-backend` `socket/init.ts` reads `socket.handshake.query.authorization` only.
       */
      createdSocket = io(API_BASE_URL, {
        query: { authorization: token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      if (cancelled) {
        createdSocket.disconnect();
        return;
      }

      setSocket(createdSocket);

      createdSocket.on("connect", () => {
        if (!cancelled) setIsConnected(true);
      });

      /** Same cadence as web `portrait-calling` heartbeat (10s). */
      const heartbeatId = setInterval(() => {
        if (createdSocket?.connected) createdSocket.emit("HEARTBEAT");
      }, 10_000);

      const bumpOnlineUsers = () => {
        queryClient.invalidateQueries({ queryKey: ["onlineUsers"] });
      };
      createdSocket.on("userStatus", bumpOnlineUsers);
      createdSocket.on("onlineUser", bumpOnlineUsers);

      const onDisconnect = () => {
        if (!cancelled) setIsConnected(false);
        clearInterval(heartbeatId);
        createdSocket?.off("userStatus", bumpOnlineUsers);
        createdSocket?.off("onlineUser", bumpOnlineUsers);
      };
      createdSocket.on("disconnect", onDisconnect);
    })();

    return () => {
      cancelled = true;
      createdSocket?.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [status, queryClient]);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
