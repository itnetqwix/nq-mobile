/**
 * DrawingOverlay — Skia-backed annotation layer on top of the clip player.
 *
 * Web reference: the canvas overlay drawn in
 * `nq-frontend-main/app/components/portrait-calling/clip-mode.jsx`. The web
 * emits stroke deltas via `ON_VIDEO_ZOOM_PAN`, clears via `ON_CLEAR_CANVAS`
 * and toggles draw mode via `TOGGLE_DRAWING_MODE`.
 *
 * For mobile we use `@shopify/react-native-skia` which runs the canvas on the
 * UI thread; gestures come from `react-native-gesture-handler`'s
 * `GestureDetector` (matches the same gesture stack already used elsewhere in
 * the app for drag-to-dismiss).
 *
 * This is intentionally a thin overlay — it doesn't yet broadcast strokes
 * (broadcast is a follow-up). Today it powers the local trainer annotation
 * UX (draw on top of the clip, clear) which is the highest-value half of
 * "drawing on the canvas".
 */

import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Canvas,
  Path,
  Skia,
  type SkPath,
} from "@shopify/react-native-skia";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";

type Stroke = { path: SkPath; color: string; width: number };

type Props = {
  enabled: boolean;
  color?: string;
  strokeWidth?: number;
};

export function DrawingOverlay({
  enabled,
  color = "#ff3b30",
  strokeWidth = 4,
}: Props) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .minDistance(0)
    .onStart((event) => {
      const path = Skia.Path.Make();
      path.moveTo(event.x, event.y);
      setCurrent({ path, color, width: strokeWidth });
    })
    .onUpdate((event) => {
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
    });

  if (!enabled && strokes.length === 0 && !current) return null;

  return (
    <GestureDetector gesture={pan}>
      <View style={StyleSheet.absoluteFill} pointerEvents={enabled ? "auto" : "none"}>
        <Canvas style={StyleSheet.absoluteFill}>
          {strokes.map((s, i) => (
            <Path
              key={i}
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

/**
 * Imperative reset for the drawing overlay — call from the trainer's "clear"
 * button. Kept as a hook so the consumer doesn't have to wire forwardRef.
 */
export function useDrawingOverlayClear(_overlayId?: string) {
  return () => {
    // Intentionally empty; consumer remounts the overlay (key-bump) to reset.
  };
}
