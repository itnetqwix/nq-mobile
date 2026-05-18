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

type Stroke = { path: SkPath; color: string; width: number };

type Props = {
  enabled: boolean;
  color?: string;
  strokeWidth?: number;
  remoteStrokes?: RemoteStroke[];
  onStrokeComplete?: (
    points: StrokePoint[],
    canvasSize: { width: number; height: number }
  ) => void;
};

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
  color = "#ff3b30",
  strokeWidth = 4,
  remoteStrokes = [],
  onStrokeComplete,
}: Props) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const pointsRef = useRef<StrokePoint[]>([]);
  const canvasSizeRef = useRef({ width: 1, height: 1 });
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });

  const pan = Gesture.Pan()
    .enabled(enabled)
    .minDistance(0)
    .onStart((event) => {
      const path = Skia.Path.Make();
      path.moveTo(event.x, event.y);
      pointsRef.current = [{ x: event.x, y: event.y }];
      setCurrent({ path, color, width: strokeWidth });
    })
    .onUpdate((event) => {
      pointsRef.current.push({ x: event.x, y: event.y });
      setCurrent((prev) => {
        if (!prev) return prev;
        const next = prev.path.copy();
        next.lineTo(event.x, event.y);
        return { ...prev, path: next };
      });
    })
    .onEnd(() => {
      setCurrent((prev) => {
        if (prev) setStrokes((s) => [...s, prev]);
        return null;
      });
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
