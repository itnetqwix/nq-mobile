/**
 * Read-only annotation layer for burn-in compositing (view-shot friendly).
 */

import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import {
  Canvas,
  matchFont,
  Path,
  Skia,
  Text as SkiaText,
} from "@shopify/react-native-skia";

import {
  projectStrokesForTarget,
  remoteStrokePath,
  type AnnotationProjectionOptions,
} from "../annotationRenderUtils";
import type { RemoteStroke } from "../useDrawingSync";

type Props = {
  strokes: RemoteStroke[];
  sourceCanvasSize: { width: number; height: number };
  width: number;
  height: number;
  projection?: AnnotationProjectionOptions;
};

export function StaticAnnotationCanvas({
  strokes,
  sourceCanvasSize,
  width,
  height,
  projection,
}: Props) {
  const target = useMemo(() => ({ width, height }), [width, height]);

  const scaled = useMemo(
    () =>
      projection
        ? projectStrokesForTarget(strokes, sourceCanvasSize, target, projection)
        : strokes,
    [projection, sourceCanvasSize, strokes, target]
  );

  const paths = useMemo(
    () => scaled.filter((s) => s.kind !== "text"),
    [scaled]
  );

  const labels = useMemo(
    () => scaled.filter((s) => s.kind === "text" && s.text),
    [scaled]
  );

  if (width <= 0 || height <= 0 || strokes.length === 0) return null;

  return (
    <View style={[styles.host, { width, height }]} pointerEvents="none">
      <Canvas style={{ width, height }}>
        {paths.map((rs, i) => (
          <Path
            key={`burn-${i}`}
            path={remoteStrokePath(rs)}
            style="stroke"
            strokeWidth={rs.width}
            color={rs.color}
          />
        ))}
        {labels.map((t, i) => {
          const p = t.points[0];
          if (!p || !t.text) return null;
          const labelFont = matchFont({ fontSize: Math.max(14, Math.round(width / 40)) });
          return (
            <SkiaText
              key={`burn-text-${i}-${t.text}`}
              x={p.x}
              y={p.y}
              text={t.text}
              color={Skia.Color(t.color)}
              font={labelFont}
            />
          );
        })}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
  },
});
