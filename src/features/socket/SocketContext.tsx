import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "../auth/context/AuthContext";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setSocketConnected, setSocketReconnectFailed } from "../../store/slices/socketSlice";
import { selectSocketConnected, selectSocketReconnectFailed } from "../../store/selectors";
import { reportOpsEvent } from "../ops/opsEventsApi";
import { getBrowserLikeRequestHeaders } from "../../api/browserRequestHeaders";
import { API_BASE_URL } from "../../config/env";
import { sanitizeHttpHeaderValue } from "../../lib/http/sanitizeHttpHeaders";
import { getClientSessionHeaders } from "../auth/session/clientSessionHeaders";
import { getAccessToken, getSessionId } from "../auth/session/tokenStorage";

/** JWT for Socket.IO — must match what `JWT.verifyAuthToken` expects (no `Bearer ` prefix). */
function normalizeSocketAuthToken(raw: string): string {
  const t = raw.trim().replace(/^\uFEFF/, "");
  if (t.toLowerCase().startsWith("bearer ")) return t.slice(7).trim();
  return t;
}

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
  reconnectFailed: boolean;
};

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  reconnectFailed: false,
});

/** Avoid flooding Metro when the API is unreachable or WebSocket upgrade fails. */
let lastSocketErrorLogAt = 0;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const isConnected = useAppSelector(selectSocketConnected);
  const reconnectFailed = useAppSelector(selectSocketReconnectFailed);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (status !== "signedIn") {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      dispatch(setSocketConnected(false));
      dispatch(setSocketReconnectFailed(false));
      return;
    }

    let cancelled = false;
    let createdSocket: Socket | null = null;

    (async () => {
      const tokenRaw = await getAccessToken();
      if (!tokenRaw || cancelled) return;
      const token = normalizeSocketAuthToken(tokenRaw);
      if (!token) return;
      const authSessionId = await getSessionId();
      const clientHeaders = getClientSessionHeaders();

      /**
       * Web parity: JWT only in handshake `auth` (not query) so the WebSocket URL stays
       * short — long query strings are rejected by some proxies before the upgrade.
       * Polling first improves reliability on mobile networks; client upgrades when possible.
       */
      createdSocket = io(API_BASE_URL, {
        path: "/socket.io",
        auth: {
          authorization: token,
          deviceId: clientHeaders["X-NQ-Device-Id"],
          ...(authSessionId ? { authSessionId } : {}),
        },
        /** Polling uses XHR — same Origin/UA as REST or Cloudflare may block (`xhr poll error`). */
        extraHeaders: {
          ...getBrowserLikeRequestHeaders(),
          ...clientHeaders,
          ...(authSessionId
            ? { "X-NQ-Auth-Session-Id": sanitizeHttpHeaderValue(authSessionId) }
            : {}),
        },
        transports: ["polling", "websocket"],
        forceNew: true,
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
        if (!cancelled) {
          dispatch(setSocketConnected(true));
          dispatch(setSocketReconnectFailed(false));
        }
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log("[socket] connected via", createdSocket?.io.engine?.transport?.name);
        }
      });

      createdSocket.on("reconnect", () => {
        if (!cancelled) {
          dispatch(setSocketConnected(true));
          dispatch(setSocketReconnectFailed(false));
        }
      });

      createdSocket.on("reconnect_failed", () => {
        if (!cancelled) {
          dispatch(setSocketReconnectFailed(true));
          reportOpsEvent({
            event_type: "SOCKET_RECONNECT_FAILED",
            category: "connection",
            severity: "error",
            title: "Socket reconnection exhausted",
          });
        }
      });

      createdSocket.on("connect_error", (err: Error & { description?: number; context?: { responseText?: string } }) => {
        const now = Date.now();
        if (now - lastSocketErrorLogAt < 15_000) return;
        lastSocketErrorLogAt = now;
        const hint = err?.context?.responseText?.slice?.(0, 120) ?? "";
        // eslint-disable-next-line no-console
        console.warn(
          "[socket] connect_error",
          err?.message ?? err,
          err?.description ? `http=${err.description}` : "",
          hint ? `body=${hint}` : "",
          `(API: ${API_BASE_URL})`
        );
      });

      /** Same cadence as web `portrait-calling` heartbeat (10s). */
      const heartbeatId = setInterval(() => {
        if (createdSocket?.connected) createdSocket.emit("HEARTBEAT");
      }, 10_000);

      const bumpPresenceQueries = () => {
        const { invalidateOnPresenceSocketEvent } = require("../../lib/socketInvalidate");
        invalidateOnPresenceSocketEvent(queryClient);
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
      dispatch(setSocketReconnectFailed(false));
    };
  }, [status, queryClient, dispatch]);

  const value = useMemo(
    () => ({ socket, isConnected, reconnectFailed }),
    [socket, isConnected, reconnectFailed]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
