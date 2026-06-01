/**
 * Trainer → trainee annotation sync (socket parity with nq-frontend).
 * Trainer emits DRAW / EMIT_CLEAR_CANVAS; backend relays to EMIT_DRAWING_CORDS / ON_CLEAR_CANVAS.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import type { ClipUserInfo } from "./clipEvents";

export const DRAWING_EVENTS = {
  DRAW: "DRAW",
  EMIT_DRAWING_CORDS: "EMIT_DRAWING_CORDS",
  EMIT_CLEAR_CANVAS: "EMIT_CLEAR_CANVAS",
  ON_CLEAR_CANVAS: "ON_CLEAR_CANVAS",
  TOGGLE_DRAWING_MODE: "TOGGLE_DRAWING_MODE",
} as const;

const MAX_REPLAY_STROKES = 400;

export type StrokePoint = { x: number; y: number };

export type AnnotationShapeKind =
  | "stroke"
  | "text"
  | "rect"
  | "circle"
  | "line"
  | "arrow";

export type RemoteStroke = {
  points: StrokePoint[];
  color: string;
  width: number;
  kind?: AnnotationShapeKind;
  text?: string;
  /** Normalized shape corners for rect/circle/line (sender space). */
  shapeBounds?: { x0: number; y0: number; x1: number; y1: number };
  /** Sender canvas size — used to scale strokes on the receiver. */
  sourceCanvasSize?: { width: number; height: number };
};

type Args = {
  socket: Socket | null;
  userInfo: ClipUserInfo;
  sessionId?: string;
  isTrainer?: boolean;
  canvasIndex?: number;
  /** Min ms between DRAW emits when network is degraded. */
  drawingEmitMinMs?: number;
};

function parseIncomingStrokePayload(
  payload: Record<string, unknown>,
  canvasSize?: { width: number; height: number }
): RemoteStroke | null | "clear" {
  const raw = payload?.strikes;
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!parsed) return null;

  if (typeof parsed === "object" && parsed !== null && (parsed as { clear?: boolean }).clear) {
    return "clear";
  }

  if (typeof parsed === "object" && parsed !== null && (parsed as { stroke?: RemoteStroke }).stroke) {
    const stroke = (parsed as { stroke: RemoteStroke }).stroke;
    if (canvasSize?.width && canvasSize?.height) {
      return { ...stroke, sourceCanvasSize: canvasSize };
    }
    return stroke;
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (obj.kind === "shape" && obj.start && obj.end) {
      const start = obj.start as StrokePoint;
      const end = obj.end as StrokePoint;
      const shapeName = String(obj.shape ?? "rect").toLowerCase();
      const kind: AnnotationShapeKind =
        shapeName === "circle" || shapeName === "oval"
          ? "circle"
          : shapeName === "line"
            ? "line"
            : shapeName === "arrow"
              ? "arrow"
              : "rect";
      const theme = obj.theme as { strokeStyle?: string; lineWidth?: number } | undefined;
      return {
        points: [],
        color: theme?.strokeStyle ?? "#ff3b30",
        width: typeof theme?.lineWidth === "number" ? theme.lineWidth : 4,
        kind,
        shapeBounds: {
          x0: Number(start.x ?? 0),
          y0: Number(start.y ?? 0),
          x1: Number(end.x ?? 0),
          y1: Number(end.y ?? 0),
        },
        sourceCanvasSize: canvasSize,
      };
    }
  }

  if (Array.isArray(parsed) && parsed.length > 0) {
    const first = parsed[0] as Record<string, unknown>;
    if (typeof first.x === "number" && typeof first.y === "number") {
      return {
        points: parsed as StrokePoint[],
        color: "#ff3b30",
        width: 4,
        kind: "stroke",
      };
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (obj.kind === "freehand" && Array.isArray(obj.points)) {
      const cw = canvasSize?.width ?? 1;
      const ch = canvasSize?.height ?? 1;
      const pts = (obj.points as Array<{ u?: number; v?: number; x?: number; y?: number }>).map(
        (p) => {
          if (typeof p.u === "number" && typeof p.v === "number") {
            return { x: p.u * cw, y: p.v * ch };
          }
          return { x: Number(p.x ?? 0), y: Number(p.y ?? 0) };
        }
      );
      return {
        points: pts,
        color: String(obj.color ?? "#ff3b30"),
        width: Number(obj.width ?? 4),
        kind: "stroke",
        sourceCanvasSize: canvasSize,
      };
    }
  }

  return null;
}

function serializeStrokeForSocket(stroke: RemoteStroke): string {
  if (
    stroke.shapeBounds &&
    stroke.kind &&
    stroke.kind !== "stroke" &&
    stroke.kind !== "text"
  ) {
    const b = stroke.shapeBounds;
    const webShape =
      stroke.kind === "circle"
        ? "circle"
        : stroke.kind === "line"
          ? "line"
          : stroke.kind === "arrow"
            ? "arrow"
            : "rect";
    return JSON.stringify({
      kind: "shape",
      coordSpace: "canvasPx",
      shape: webShape,
      start: { x: b.x0, y: b.y0 },
      end: { x: b.x1, y: b.y1 },
      theme: { strokeStyle: stroke.color, lineWidth: stroke.width },
    });
  }
  return JSON.stringify({ stroke });
}

export function useDrawingSync({
  socket,
  userInfo,
  sessionId,
  isTrainer = false,
  canvasIndex = 1,
  drawingEmitMinMs = 0,
}: Args) {
  const [remoteStrokes, setRemoteStrokes] = useState<RemoteStroke[]>([]);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const strokeBufferRef = useRef<RemoteStroke[]>([]);
  const lastEmitAtRef = useRef(0);
  const pendingStrokeRef = useRef<{
    stroke: RemoteStroke;
    canvasSize: { width: number; height: number };
  } | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawingEmitMinMsRef = useRef(drawingEmitMinMs);
  drawingEmitMinMsRef.current = drawingEmitMinMs;

  const [committedStrokeCount, setCommittedStrokeCount] = useState(0);

  const syncStrokeCount = useCallback(() => {
    setCommittedStrokeCount(strokeBufferRef.current.length);
  }, []);

  const pushStrokeToBuffer = useCallback((stroke: RemoteStroke) => {
    const buf = strokeBufferRef.current;
    buf.push(stroke);
    if (buf.length > MAX_REPLAY_STROKES) {
      strokeBufferRef.current = buf.slice(-MAX_REPLAY_STROKES);
    }
    setCommittedStrokeCount(strokeBufferRef.current.length);
  }, []);

  const rebroadcastStrokeBuffer = useCallback(() => {
    if (!isTrainer || !socket) return;
    try {
      socket.emit(DRAWING_EVENTS.EMIT_CLEAR_CANVAS, {
        userInfo,
        sessionId,
        canvasIndex,
      });
      for (const stroke of strokeBufferRef.current) {
        socket.emit(DRAWING_EVENTS.DRAW, {
          strikes: serializeStrokeForSocket(stroke),
          canvasSize: { width: 1, height: 1 },
          userInfo,
          sessionId,
          canvasIndex,
        });
      }
    } catch {
      /* emit must not crash annotation UI */
    }
  }, [canvasIndex, isTrainer, sessionId, socket, userInfo]);

  const applyRemoteStroke = useCallback(
    (stroke: RemoteStroke) => {
      setRemoteStrokes((s) => [...s, stroke]);
    },
    []
  );

  useEffect(() => {
    if (!socket) return;

    const matchesSession = (payload: { sessionId?: string }) => {
      if (!sessionId) return true;
      const sid = payload?.sessionId;
      return !sid || String(sid) === String(sessionId);
    };

    const onCoords = (payload: Record<string, unknown>) => {
      if (!matchesSession(payload as { sessionId?: string })) return;
      const from = (payload?.userInfo as ClipUserInfo | undefined)?.from_user;
      if (from && String(from) === String(userInfo.from_user)) return;

      const canvasSize = payload?.canvasSize as { width: number; height: number } | undefined;
      const parsed = parseIncomingStrokePayload(payload, canvasSize);
      if (parsed === "clear") {
        setRemoteStrokes([]);
        return;
      }
      if (parsed) applyRemoteStroke(parsed);
    };

    const onClear = (payload?: { sessionId?: string }) => {
      if (payload && !matchesSession(payload)) return;
      setRemoteStrokes([]);
    };

    const onToggle = (payload: Record<string, unknown>) => {
      if (!matchesSession(payload as { sessionId?: string })) return;
      if (isTrainer) return;
      const enabled =
        payload?.drawingMode ?? payload?.enabled ?? payload?.drawingEnabled;
      setDrawingEnabled(!!enabled);
    };

    socket.on(DRAWING_EVENTS.EMIT_DRAWING_CORDS, onCoords);
    socket.on(DRAWING_EVENTS.ON_CLEAR_CANVAS, onClear);
    socket.on(DRAWING_EVENTS.TOGGLE_DRAWING_MODE, onToggle);

    return () => {
      socket.off(DRAWING_EVENTS.EMIT_DRAWING_CORDS, onCoords);
      socket.off(DRAWING_EVENTS.ON_CLEAR_CANVAS, onClear);
      socket.off(DRAWING_EVENTS.TOGGLE_DRAWING_MODE, onToggle);
    };
  }, [socket, userInfo.from_user, isTrainer, sessionId, applyRemoteStroke]);

  const flushPendingStroke = useCallback(() => {
    const pending = pendingStrokeRef.current;
    pendingStrokeRef.current = null;
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    if (!pending || !isTrainer || !socket) return;
    pushStrokeToBuffer(pending.stroke);
    lastEmitAtRef.current = Date.now();
    try {
      socket.emit(DRAWING_EVENTS.DRAW, {
        strikes: serializeStrokeForSocket(pending.stroke),
        canvasSize: pending.canvasSize,
        userInfo,
        sessionId,
        canvasIndex,
      });
    } catch {
      /* emit must not crash annotation UI */
    }
  }, [canvasIndex, isTrainer, pushStrokeToBuffer, sessionId, socket, userInfo]);

  const emitStroke = useCallback(
    (stroke: RemoteStroke, canvasSize: { width: number; height: number }) => {
      if (!isTrainer || !socket) return;
      const minMs = drawingEmitMinMsRef.current;
      const now = Date.now();
      if (minMs <= 0 || now - lastEmitAtRef.current >= minMs) {
        pushStrokeToBuffer(stroke);
        lastEmitAtRef.current = now;
        try {
          socket.emit(DRAWING_EVENTS.DRAW, {
            strikes: serializeStrokeForSocket(stroke),
            canvasSize,
            userInfo,
            sessionId,
            canvasIndex,
          });
        } catch {
          /* emit must not crash annotation UI */
        }
        return;
      }
      pendingStrokeRef.current = { stroke, canvasSize };
      if (!pendingTimerRef.current) {
        const wait = Math.max(16, minMs - (now - lastEmitAtRef.current));
        pendingTimerRef.current = setTimeout(() => {
          pendingTimerRef.current = null;
          flushPendingStroke();
        }, wait);
      }
    },
    [
      canvasIndex,
      flushPendingStroke,
      isTrainer,
      pushStrokeToBuffer,
      sessionId,
      socket,
      userInfo,
    ]
  );

  useEffect(
    () => () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    },
    []
  );

  const clearCanvas = useCallback(() => {
    setRemoteStrokes([]);
    strokeBufferRef.current = [];
    syncStrokeCount();
    if (!isTrainer || !socket) return;
    socket.emit(DRAWING_EVENTS.EMIT_CLEAR_CANVAS, {
      userInfo,
      sessionId,
      canvasIndex,
    });
  }, [canvasIndex, isTrainer, sessionId, socket, syncStrokeCount, userInfo]);

  /** Web parity: pop last stroke, clear peer canvas, replay remaining strokes. */
  const undoLastStroke = useCallback(() => {
    if (!isTrainer || strokeBufferRef.current.length === 0) return false;
    if (pendingStrokeRef.current) {
      pendingStrokeRef.current = null;
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    }
    strokeBufferRef.current.pop();
    syncStrokeCount();
    setRemoteStrokes([]);
    rebroadcastStrokeBuffer();
    return true;
  }, [isTrainer, rebroadcastStrokeBuffer, syncStrokeCount]);

  const setTrainerDrawingEnabled = useCallback(
    (enabled: boolean) => {
      setDrawingEnabled(enabled);
      if (!isTrainer || !socket) return;
      socket.emit(DRAWING_EVENTS.TOGGLE_DRAWING_MODE, {
        enabled,
        drawingMode: enabled,
        userInfo,
        sessionId,
        canvasIndex,
      });
    },
    [canvasIndex, isTrainer, sessionId, socket, userInfo]
  );

  const replaySocketState = useCallback(() => {
    if (!isTrainer || !socket?.connected) return;
    socket.emit(DRAWING_EVENTS.TOGGLE_DRAWING_MODE, {
      enabled: drawingEnabled,
      drawingMode: drawingEnabled,
      userInfo,
      sessionId,
      canvasIndex,
    });
    for (const stroke of strokeBufferRef.current) {
      try {
        socket.emit(DRAWING_EVENTS.DRAW, {
          strikes: serializeStrokeForSocket(stroke),
          canvasSize: { width: 1, height: 1 },
          userInfo,
          sessionId,
          canvasIndex,
        });
      } catch {
        /* ignore */
      }
    }
  }, [canvasIndex, drawingEnabled, isTrainer, sessionId, socket, userInfo]);

  return {
    remoteStrokes,
    drawingEnabled,
    canUndo: committedStrokeCount > 0,
    setTrainerDrawingEnabled,
    emitStroke,
    clearCanvas,
    undoLastStroke,
    resetRemote: () => {
      setRemoteStrokes([]);
      strokeBufferRef.current = [];
      syncStrokeCount();
    },
    replaySocketState,
  };
}
