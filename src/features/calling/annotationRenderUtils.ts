/**
 * Shared Skia path helpers for live annotations and burn-in capture.
 */

import { Skia, type SkPath } from "@shopify/react-native-skia";

import {
  canvasPointToContentUV,
  canvasPointToNormalizedCanvas,
  contentUVToCanvasPoint,
  type AnnotationFitMode,
  type ContentAspect,
} from "./annotationCoords";
import type { RemoteStroke, StrokePoint } from "./useDrawingSync";

export function pointsToPath(points: StrokePoint[]): SkPath {
  const path = Skia.Path.Make();
  if (points.length === 0) return path;
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i].x, points[i].y);
  }
  return path;
}

export function remoteStrokePath(stroke: RemoteStroke): SkPath {
  const kind = stroke.kind ?? "stroke";
  const bounds = stroke.shapeBounds;
  if (bounds) {
    const x0 = bounds.x0;
    const y0 = bounds.y0;
    const x1 = bounds.x1;
    const y1 = bounds.y1;
    const path = Skia.Path.Make();
    if (kind === "rect") {
      path.addRect({
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0),
      });
      return path;
    }
    if (kind === "circle") {
      path.addOval({
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0),
      });
      return path;
    }
    if (kind === "line" || kind === "arrow") {
      path.moveTo(x0, y0);
      path.lineTo(x1, y1);
      if (kind === "arrow") {
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
  }
  const path = pointsToPath(stroke.points);
  if (kind === "rect" || kind === "circle") {
    path.close();
  }
  return path;
}

export function scaleStrokeForCanvas(
  stroke: RemoteStroke,
  target: { width: number; height: number }
): RemoteStroke {
  const source = stroke.sourceCanvasSize;
  if (
    !source ||
    source.width <= 0 ||
    source.height <= 0 ||
    target.width <= 0 ||
    target.height <= 0
  ) {
    return stroke;
  }
  const sx = target.width / source.width;
  const sy = target.height / source.height;
  const scale = (sx + sy) / 2;
  const bounds = stroke.shapeBounds;
  return {
    ...stroke,
    points: stroke.points.map((p) => ({ x: p.x * sx, y: p.y * sy })),
    width: stroke.width * scale,
    shapeBounds: bounds
      ? {
          x0: bounds.x0 * sx,
          y0: bounds.y0 * sy,
          x1: bounds.x1 * sx,
          y1: bounds.y1 * sy,
        }
      : undefined,
  };
}

export function normalizeStrokesForTarget(
  strokes: RemoteStroke[],
  sourceCanvas: { width: number; height: number },
  target: { width: number; height: number }
): RemoteStroke[] {
  const withSource = strokes.map((s) => ({
    ...s,
    sourceCanvasSize: s.sourceCanvasSize ?? sourceCanvas,
  }));
  return withSource.map((s) => scaleStrokeForCanvas(s, target));
}

/** Map a stroke into overlay pixel space for rendering or burn-in. */
export function projectStrokeToCanvas(
  stroke: RemoteStroke,
  target: { width: number; height: number },
  aspect?: ContentAspect | null,
  fit: AnnotationFitMode = "contain"
): RemoteStroke {
  if (
    stroke.coordSpace === "contentUv" &&
    aspect &&
    aspect.width > 0 &&
    aspect.height > 0 &&
    target.width > 0 &&
    target.height > 0
  ) {
    const mapPt = (u: number, v: number) => {
      const pt = contentUVToCanvasPoint(u, v, target.width, target.height, aspect, fit);
      return pt ?? { x: u * target.width, y: v * target.height };
    };
    const bounds = stroke.shapeBounds;
    return {
      ...stroke,
      points: stroke.points.map((p) => mapPt(p.x, p.y)),
      shapeBounds: bounds
        ? {
            x0: mapPt(bounds.x0, bounds.y0).x,
            y0: mapPt(bounds.x0, bounds.y0).y,
            x1: mapPt(bounds.x1, bounds.y1).x,
            y1: mapPt(bounds.x1, bounds.y1).y,
          }
        : undefined,
    };
  }
  if (stroke.coordSpace === "normalizedCanvas" && target.width > 0 && target.height > 0) {
    return {
      ...stroke,
      points: stroke.points.map((p) => ({
        x: p.x * target.width,
        y: p.y * target.height,
      })),
      shapeBounds: stroke.shapeBounds
        ? {
            x0: stroke.shapeBounds.x0 * target.width,
            y0: stroke.shapeBounds.y0 * target.height,
            x1: stroke.shapeBounds.x1 * target.width,
            y1: stroke.shapeBounds.y1 * target.height,
          }
        : undefined,
    };
  }
  return scaleStrokeForCanvas(stroke, target);
}

/** Build socket payload stroke with cross-device-safe coordinates. */
export function strokeForSyncEmit(
  stroke: RemoteStroke,
  canvasSize: { width: number; height: number },
  options?: {
    contentAspect?: ContentAspect | null;
    contentFit?: AnnotationFitMode;
    targetUserId?: string | null;
  }
): RemoteStroke {
  const aspect = options?.contentAspect;
  const fit = options?.contentFit ?? "contain";
  const targetUserId = options?.targetUserId ?? null;
  if (aspect && aspect.width > 0 && aspect.height > 0) {
    const toUv = (x: number, y: number) => {
      const uv =
        canvasPointToContentUV(x, y, canvasSize.width, canvasSize.height, aspect, fit) ??
        canvasPointToNormalizedCanvas(x, y, canvasSize.width, canvasSize.height);
      return { x: uv.u, y: uv.v };
    };
    const bounds = stroke.shapeBounds;
    return {
      ...stroke,
      coordSpace: "contentUv",
      contentAspect: aspect,
      contentFit: fit,
      targetUserId,
      sourceCanvasSize: canvasSize,
      points: stroke.points.map((p) => toUv(p.x, p.y)),
      shapeBounds: bounds
        ? {
            x0: toUv(bounds.x0, bounds.y0).x,
            y0: toUv(bounds.x0, bounds.y0).y,
            x1: toUv(bounds.x1, bounds.y1).x,
            y1: toUv(bounds.x1, bounds.y1).y,
          }
        : undefined,
    };
  }
  const toUv = (x: number, y: number) =>
    canvasPointToNormalizedCanvas(x, y, canvasSize.width, canvasSize.height);
  const bounds = stroke.shapeBounds;
  return {
    ...stroke,
    coordSpace: "normalizedCanvas",
    sourceCanvasSize: canvasSize,
    points: stroke.points.map((p) => {
      const uv = toUv(p.x, p.y);
      return { x: uv.u, y: uv.v };
    }),
    shapeBounds: bounds
      ? {
          x0: toUv(bounds.x0, bounds.y0).u,
          y0: toUv(bounds.x0, bounds.y0).v,
          x1: toUv(bounds.x1, bounds.y1).u,
          y1: toUv(bounds.x1, bounds.y1).v,
        }
      : undefined,
  };
}
