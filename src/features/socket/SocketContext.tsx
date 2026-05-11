import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
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

      createdSocket = io(API_BASE_URL, {
        auth: { authorization: token },
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
      createdSocket.on("disconnect", () => {
        if (!cancelled) setIsConnected(false);
      });

      const heartbeatId = setInterval(() => {
        if (createdSocket?.connected) createdSocket.emit("HEARTBEAT");
      }, 15000);

      createdSocket.on("disconnect", () => clearInterval(heartbeatId));
    })();

    return () => {
      cancelled = true;
      createdSocket?.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [status]);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
