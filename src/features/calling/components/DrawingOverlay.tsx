/**
 * Skia annotation layer with optional socket sync (trainer → trainee).
 * Gesture handlers run on JS thread via runOnJS to avoid worklet/state crashes.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import {
  Canvas,
  Path,
  Skia,
  type SkPath,
} from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

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

function freehandPathFromPoints(points: StrokePoint[]): SkPath {
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

  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const strokeWidthRef = useRef(strokeWidth);
  toolRef.current = tool;
  colorRef.current = color;
  strokeWidthRef.current = strokeWidth;

  const commitStroke = useCallback((stroke: Stroke) => {
    setStrokes((s) => [...s, stroke]);
    setCurrent(null);
  }, []);

  const finishShape = useCallback(
    (x0: number, y0: number, x1: number, y1: number) => {
      const t = toolRef.current;
      const path = shapePath(t, x0, y0, x1, y1);
      commitStroke({ path, color: colorRef.current, width: strokeWidthRef.current });
      const pts = shapePoints(t, x0, y0, x1, y1);
      try {
        onStrokeComplete?.(pts, canvasSizeRef.current);
      } catch {
        /* socket emit must not crash drawing */
      }
    },
    [commitStroke, onStrokeComplete]
  );

  const updateFreehand = useCallback((x: number, y: number) => {
    pointsRef.current.push({ x, y });
    const path = freehandPathFromPoints(pointsRef.current);
    setCurrent({ path, color: colorRef.current, width: strokeWidthRef.current });
  }, []);

  const finishFreehand = useCallback(() => {
    const pts = [...pointsRef.current];
    pointsRef.current = [];
    startRef.current = null;
    setCurrent(null);
    if (pts.length > 1) {
      const path = freehandPathFromPoints(pts);
      setStrokes((s) => [
        ...s,
        { path, color: colorRef.current, width: strokeWidthRef.current },
      ]);
      try {
        onStrokeComplete?.(pts, canvasSizeRef.current);
      } catch {
        /* ignore */
      }
    }
  }, [onStrokeComplete]);

  const onPanStart = useCallback(
    (x: number, y: number) => {
      startRef.current = { x, y };
      if (toolRef.current !== "freehand") {
        const path = shapePath(toolRef.current, x, y, x, y);
        setCurrent({ path, color: colorRef.current, width: strokeWidthRef.current });
        return;
      }
      pointsRef.current = [{ x, y }];
      setCurrent({
        path: freehandPathFromPoints(pointsRef.current),
        color: colorRef.current,
        width: strokeWidthRef.current,
      });
    },
    []
  );

  const onPanUpdate = useCallback((x: number, y: number) => {
    const start = startRef.current;
    if (!start) return;
    if (toolRef.current !== "freehand") {
      const path = shapePath(toolRef.current, start.x, start.y, x, y);
      setCurrent({ path, color: colorRef.current, width: strokeWidthRef.current });
      return;
    }
    updateFreehand(x, y);
  }, [updateFreehand]);

  const onPanEnd = useCallback(
    (x: number, y: number) => {
      const start = startRef.current;
      if (!start) return;
      if (toolRef.current !== "freehand") {
        finishShape(start.x, start.y, x, y);
        return;
      }
      updateFreehand(x, y);
      finishFreehand();
    },
    [finishFreehand, finishShape, updateFreehand]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .minDistance(0)
        .onStart((e) => {
          runOnJS(onPanStart)(e.x, e.y);
        })
        .onUpdate((e) => {
          runOnJS(onPanUpdate)(e.x, e.y);
        })
        .onEnd((e) => {
          runOnJS(onPanEnd)(e.x, e.y);
        }),
    [enabled, onPanEnd, onPanStart, onPanUpdate]
  );

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
