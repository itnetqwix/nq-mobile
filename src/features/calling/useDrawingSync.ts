/**
 * Broadcasts trainer stroke batches over EMIT_DRAWING_CORDS (web parity).
 */

import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

import type { ClipUserInfo } from "./clipEvents";

export const DRAWING_EVENTS = {
  EMIT_DRAWING_CORDS: "EMIT_DRAWING_CORDS",
  ON_CLEAR_CANVAS: "ON_CLEAR_CANVAS",
  TOGGLE_DRAWING_MODE: "TOGGLE_DRAWING_MODE",
} as const;

export type StrokePoint = { x: number; y: number };

export type RemoteStroke = {
  points: StrokePoint[];
  color: string;
  width: number;
};

type Args = {
  socket: Socket | null;
  userInfo: ClipUserInfo;
  sessionId?: string;
  isTrainer?: boolean;
  canvasIndex?: number;
};

export function useDrawingSync({
  socket,
  userInfo,
  sessionId,
  isTrainer = false,
  canvasIndex = 1,
}: Args) {
  const [remoteStrokes, setRemoteStrokes] = useState<RemoteStroke[]>([]);
  const [drawingEnabled, setDrawingEnabled] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const onCoords = (payload: any) => {
      const from = payload?.userInfo?.from_user;
      if (from && String(from) === String(userInfo.from_user)) return;
      try {
        const raw = payload?.strikes;
        const parsed =
          typeof raw === "string"
            ? JSON.parse(raw)
            : Array.isArray(raw)
              ? raw
              : null;
        if (!parsed) return;
        if (parsed.clear) {
          setRemoteStrokes([]);
          return;
        }
        if (parsed.stroke) {
          setRemoteStrokes((s) => [...s, parsed.stroke as RemoteStroke]);
        }
      } catch {
        /* ignore malformed payloads */
      }
    };

    const onClear = () => {
      setRemoteStrokes([]);
    };

    const onToggle = (payload: any) => {
      if (isTrainer) return;
      setDrawingEnabled(!!payload?.enabled);
    };

    socket.on(DRAWING_EVENTS.EMIT_DRAWING_CORDS, onCoords);
    socket.on(DRAWING_EVENTS.ON_CLEAR_CANVAS, onClear);
    socket.on(DRAWING_EVENTS.TOGGLE_DRAWING_MODE, onToggle);

    return () => {
      socket.off(DRAWING_EVENTS.EMIT_DRAWING_CORDS, onCoords);
      socket.off(DRAWING_EVENTS.ON_CLEAR_CANVAS, onClear);
      socket.off(DRAWING_EVENTS.TOGGLE_DRAWING_MODE, onToggle);
    };
  }, [socket, userInfo.from_user, isTrainer]);

  const emitStroke = useCallback(
    (stroke: RemoteStroke, canvasSize: { width: number; height: number }) => {
      if (!isTrainer || !socket) return;
      try {
        socket.emit(DRAWING_EVENTS.EMIT_DRAWING_CORDS, {
          strikes: JSON.stringify({ stroke }),
          canvasSize,
          userInfo,
          sessionId,
        });
      } catch {
        /* emit must not crash annotation UI */
      }
    },
    [isTrainer, socket, userInfo, sessionId]
  );

  const clearCanvas = useCallback(() => {
    setRemoteStrokes([]);
    if (!isTrainer || !socket) return;
    socket.emit(DRAWING_EVENTS.ON_CLEAR_CANVAS, {
      userInfo,
      sessionId,
      canvasIndex,
    });
    socket.emit(DRAWING_EVENTS.EMIT_DRAWING_CORDS, {
      strikes: JSON.stringify({ clear: true }),
      canvasSize: { width: 1, height: 1 },
      userInfo,
      sessionId,
    });
  }, [canvasIndex, isTrainer, sessionId, socket, userInfo]);

  const setTrainerDrawingEnabled = useCallback(
    (enabled: boolean) => {
      setDrawingEnabled(enabled);
      if (!isTrainer || !socket) return;
      socket.emit(DRAWING_EVENTS.TOGGLE_DRAWING_MODE, {
        enabled,
        userInfo,
        sessionId,
      });
    },
    [isTrainer, sessionId, socket, userInfo]
  );

  return {
    remoteStrokes,
    drawingEnabled,
    setTrainerDrawingEnabled,
    emitStroke,
    clearCanvas,
    resetRemote: () => setRemoteStrokes([]),
  };
}
