/**
 * Skia annotation layer with optional socket sync (trainer → trainee).
 */

import React, { useRef, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import {
  Canvas,
  Path,
  Skia,
  type SkPath,
} from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import type { RemoteStroke, StrokePoint } from "../useDrawingSync";
import type { AnnotationTool } from "./MeetingAnnotationToolbar";

type Stroke = { path: SkPath; color: string; width: number };

type Props = {
  enabled: boolean;
  tool?: AnnotationTool;
  color?: string;
  strokeWidth?: number;
  remoteStrokes?: RemoteStroke[];
  onStrokeComplete?: (
    points: StrokePoint[],
    canvasSize: { width: number; height: number }
  ) => void;
};

function shapePath(tool: AnnotationTool, x0: number, y0: number, x1: number, y1: number): SkPath {
  const path = Skia.Path.Make();
  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const w = Math.abs(x1 - x0);
  const h = Math.abs(y1 - y0);
  if (tool === "line" || tool === "arrow") {
    path.moveTo(x0, y0);
    path.lineTo(x1, y1);
    if (tool === "arrow") {
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const head = 12;
      path.moveTo(x1, y1);
      path.lineTo(
        x1 - head * Math.cos(angle - Math.PI / 6),
        y1 - head * Math.sin(angle - Math.PI / 6)
      );
      path.moveTo(x1, y1);
      path.lineTo(
        x1 - head * Math.cos(angle + Math.PI / 6),
        y1 - head * Math.sin(angle + Math.PI / 6)
      );
    }
    return path;
  }
  if (tool === "rect") {
    path.addRect({ x: left, y: top, width: w, height: h });
    return path;
  }
  if (tool === "circle") {
    path.addOval({ x: left, y: top, width: w, height: h });
    return path;
  }
  return path;
}

function shapePoints(tool: AnnotationTool, x0: number, y0: number, x1: number, y1: number): StrokePoint[] {
  if (tool === "line" || tool === "arrow") {
    return [
      { x: x0, y: y0 },
      { x: x1, y: y1 },
    ];
  }
  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const right = Math.max(x0, x1);
  const bottom = Math.max(y0, y1);
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function pointsToPath(points: StrokePoint[]): SkPath {
  const path = Skia.Path.Make();
  if (points.length === 0) return path;
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i].x, points[i].y);
  }
  return path;
}

export function DrawingOverlay({
  enabled,
  tool = "freehand",
  color = "#ff3b30",
  strokeWidth = 4,
  remoteStrokes = [],
  onStrokeComplete,
}: Props) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const pointsRef = useRef<StrokePoint[]>([]);
  const startRef = useRef<StrokePoint | null>(null);
  const canvasSizeRef = useRef({ width: 1, height: 1 });
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });

  const pan = Gesture.Pan()
    .enabled(enabled)
    .minDistance(0)
    .onStart((event) => {
      startRef.current = { x: event.x, y: event.y };
      if (tool !== "freehand") {
        const path = shapePath(tool, event.x, event.y, event.x, event.y);
        setCurrent({ path, color, width: strokeWidth });
        return;
      }
      const path = Skia.Path.Make();
      path.moveTo(event.x, event.y);
      pointsRef.current = [{ x: event.x, y: event.y }];
      setCurrent({ path, color, width: strokeWidth });
    })
    .onUpdate((event) => {
      const start = startRef.current;
      if (!start) return;
      if (tool !== "freehand") {
        const path = shapePath(tool, start.x, start.y, event.x, event.y);
        setCurrent({ path, color, width: strokeWidth });
        return;
      }
      pointsRef.current.push({ x: event.x, y: event.y });
      setCurrent((prev) => {
        if (!prev) return prev;
        const next = prev.path.copy();
        next.lineTo(event.x, event.y);
        return { ...prev, path: next };
      });
    })
    .onEnd((event) => {
      const start = startRef.current;
      startRef.current = null;
      setCurrent((prev) => {
        if (prev) setStrokes((s) => [...s, prev]);
        return null;
      });
      if (!start) return;
      if (tool !== "freehand") {
        const pts = shapePoints(tool, start.x, start.y, event.x, event.y);
        onStrokeComplete?.(pts, canvasSizeRef.current);
        return;
      }
      if (pointsRef.current.length > 1) {
        onStrokeComplete?.(pointsRef.current, canvasSizeRef.current);
      }
      pointsRef.current = [];
    });

  if (!enabled && strokes.length === 0 && !current && remoteStrokes.length === 0) {
    return null;
  }

  return (
    <GestureDetector gesture={pan}>
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={enabled ? "auto" : "box-none"}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) {
            const size = { width, height };
            canvasSizeRef.current = size;
            setCanvasSize(size);
          }
        }}
      >
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {remoteStrokes.map((rs, i) => (
            <Path
              key={`remote-${i}`}
              path={pointsToPath(rs.points)}
              style="stroke"
              strokeWidth={rs.width}
              color={rs.color}
            />
          ))}
          {strokes.map((s, i) => (
            <Path
              key={`local-${i}`}
              path={s.path}
              style="stroke"
              strokeWidth={s.width}
              color={s.color}
            />
          ))}
          {current ? (
            <Path
              path={current.path}
              style="stroke"
              strokeWidth={current.width}
              color={current.color}
            />
          ) : null}
        </Canvas>
      </View>
    </GestureDetector>
  );
}
