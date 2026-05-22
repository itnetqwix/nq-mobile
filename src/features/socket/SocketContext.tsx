import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "../auth/context/AuthContext";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setSocketConnected } from "../../store/slices/socketSlice";
import { selectSocketConnected } from "../../store/selectors";
import { API_BASE_URL } from "../../config/env";
import { getAccessToken } from "../auth/session/tokenStorage";

/** JWT for Socket.IO — must match what `JWT.verifyAuthToken` expects (no `Bearer ` prefix). */
function normalizeSocketAuthToken(raw: string): string {
  const t = raw.trim().replace(/^\uFEFF/, "");
  if (t.toLowerCase().startsWith("bearer ")) return t.slice(7).trim();
  return t;
}

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextValue>({ socket: null, isConnected: false });

/** Avoid flooding Metro when the API is unreachable or WebSocket upgrade fails. */
let lastSocketErrorLogAt = 0;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const isConnected = useAppSelector(selectSocketConnected);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (status !== "signedIn") {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      dispatch(setSocketConnected(false));
      return;
    }

    let cancelled = false;
    let createdSocket: Socket | null = null;

    (async () => {
      const tokenRaw = await getAccessToken();
      if (!tokenRaw || cancelled) return;
      const token = normalizeSocketAuthToken(tokenRaw);
      if (!token) return;

      /**
       * Web parity: JWT only in handshake `auth` (not query) so the WebSocket URL stays
       * short — long query strings are rejected by some proxies before the upgrade.
       * Polling first improves reliability on mobile networks; client upgrades when possible.
       */
      createdSocket = io(API_BASE_URL, {
        auth: { authorization: token },
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 10_000,
        timeout: 30_000,
        upgrade: true,
        rememberUpgrade: true,
      });

      if (cancelled) {
        createdSocket.disconnect();
        return;
      }

      setSocket(createdSocket);

      createdSocket.on("connect", () => {
        if (!cancelled) dispatch(setSocketConnected(true));
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log("[socket] connected via", createdSocket?.io.engine?.transport?.name);
        }
      });

      createdSocket.on("connect_error", (err) => {
        if (!__DEV__) return;
        const now = Date.now();
        if (now - lastSocketErrorLogAt < 15_000) return;
        lastSocketErrorLogAt = now;
        // eslint-disable-next-line no-console
        console.warn(
          "[socket] connect_error",
          err?.message ?? err,
          `(API: ${API_BASE_URL})`
        );
      });

      /** Same cadence as web `portrait-calling` heartbeat (10s). */
      const heartbeatId = setInterval(() => {
        if (createdSocket?.connected) createdSocket.emit("HEARTBEAT");
      }, 10_000);

      const bumpPresenceQueries = () => {
        queryClient.invalidateQueries({ queryKey: ["onlineUsers"] });
        queryClient.invalidateQueries({ queryKey: ["bookExpert", "online"] });
        queryClient.invalidateQueries({ queryKey: ["friends"] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        queryClient.invalidateQueries({ queryKey: ["recentTrainees"] });
        queryClient.invalidateQueries({ queryKey: ["communityUsers"] });
      };
      createdSocket.on("userStatus", bumpPresenceQueries);
      createdSocket.on("onlineUser", bumpPresenceQueries);

      const onDisconnect = () => {
        if (!cancelled) dispatch(setSocketConnected(false));
        clearInterval(heartbeatId);
        createdSocket?.off("userStatus", bumpPresenceQueries);
        createdSocket?.off("onlineUser", bumpPresenceQueries);
      };
      createdSocket.on("disconnect", onDisconnect);
    })();

    return () => {
      cancelled = true;
      createdSocket?.disconnect();
      setSocket(null);
      dispatch(setSocketConnected(false));
    };
  }, [status, queryClient, dispatch]);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
