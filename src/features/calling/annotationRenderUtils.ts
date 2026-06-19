/**
 * Shared Skia path helpers for live annotations and burn-in capture.
 */

import { Skia, type SkPath } from "@shopify/react-native-skia";

import {
  canvasPointToContentUV,
  canvasPointToNormalizedCanvas,
  contentUVToCanvasPoint,
  getContentRect,
  localVideoPointToOverlayPoint,
  overlayPointToLocalVideoPoint,
  resolveAnnotationMappingFrame,
  type AnnotationFitMode,
  type ContentAspect,
  type ContentInsets,
  type ContentRect,
} from "./annotationCoords";
import type { PanPoint } from "./clipZoomPanUtils";
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

export type AnnotationProjectionOptions = {
  contentAspect?: ContentAspect | null;
  contentFit?: AnnotationFitMode;
  contentInsets?: ContentInsets;
  measuredContentRect?: ContentRect | null;
  zoomPan?: { zoom: number; pan: PanPoint } | null;
};

/** Map a stroke into overlay pixel space for rendering or burn-in. */
export function projectStrokeToCanvas(
  stroke: RemoteStroke,
  target: { width: number; height: number },
  aspect?: ContentAspect | null,
  fit: AnnotationFitMode = "contain",
  contentInsets?: ContentInsets,
  options?: Omit<AnnotationProjectionOptions, "contentAspect" | "contentFit" | "contentInsets">
): RemoteStroke {
  const frame = resolveAnnotationMappingFrame(target, {
    contentInsets,
    measuredContentRect: options?.measuredContentRect,
  });
  const renderAspect = stroke.contentAspect ?? aspect;
  const renderFit = stroke.contentFit ?? fit;
  const zoomPan = options?.zoomPan ?? null;
  if (
    stroke.coordSpace === "contentUv" &&
    renderAspect &&
    renderAspect.width > 0 &&
    renderAspect.height > 0 &&
    frame.width > 0 &&
    frame.height > 0
  ) {
    const mapPt = (u: number, v: number) => {
      const local = contentUVToCanvasPoint(
        u,
        v,
        frame.width,
        frame.height,
        renderAspect,
        renderFit
      );
      if (!local) {
        return { x: u * frame.width + frame.offsetX, y: v * frame.height + frame.offsetY };
      }
      return localVideoPointToOverlayPoint(
        local.x,
        local.y,
        frame,
        renderAspect,
        renderFit,
        zoomPan
      );
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
  if (stroke.coordSpace === "normalizedCanvas" && frame.width > 0 && frame.height > 0) {
    return {
      ...stroke,
      points: stroke.points.map((p) => ({
        x: p.x * frame.width + frame.offsetX,
        y: p.y * frame.height + frame.offsetY,
      })),
      shapeBounds: stroke.shapeBounds
        ? {
            x0: stroke.shapeBounds.x0 * frame.width + frame.offsetX,
            y0: stroke.shapeBounds.y0 * frame.height + frame.offsetY,
            x1: stroke.shapeBounds.x1 * frame.width + frame.offsetX,
            y1: stroke.shapeBounds.y1 * frame.height + frame.offsetY,
          }
        : undefined,
    };
  }
  const scaled = scaleStrokeForCanvas(stroke, { width: frame.width, height: frame.height });
  return {
    ...scaled,
    points: scaled.points.map((p) => ({
      x: p.x + frame.offsetX,
      y: p.y + frame.offsetY,
    })),
    shapeBounds: scaled.shapeBounds
      ? {
          x0: scaled.shapeBounds.x0 + frame.offsetX,
          y0: scaled.shapeBounds.y0 + frame.offsetY,
          x1: scaled.shapeBounds.x1 + frame.offsetX,
          y1: scaled.shapeBounds.y1 + frame.offsetY,
        }
      : undefined,
  };
}

function unoffsetStrokePoints(
  stroke: RemoteStroke,
  offsetX: number,
  offsetY: number
): RemoteStroke {
  if (!offsetX && !offsetY) return stroke;
  return {
    ...stroke,
    points: stroke.points.map((p) => ({ x: p.x - offsetX, y: p.y - offsetY })),
    shapeBounds: stroke.shapeBounds
      ? {
          x0: stroke.shapeBounds.x0 - offsetX,
          y0: stroke.shapeBounds.y0 - offsetY,
          x1: stroke.shapeBounds.x1 - offsetX,
          y1: stroke.shapeBounds.y1 - offsetY,
        }
      : undefined,
  };
}

/** Build socket payload stroke with cross-device-safe coordinates. */
export function strokeForSyncEmit(
  stroke: RemoteStroke,
  canvasSize: { width: number; height: number },
  options?: AnnotationProjectionOptions & {
    targetUserId?: string | null;
  }
): RemoteStroke {
  const frame = resolveAnnotationMappingFrame(canvasSize, {
    contentInsets: options?.contentInsets,
    measuredContentRect: options?.measuredContentRect,
  });
  const localStroke = unoffsetStrokePoints(stroke, frame.offsetX, frame.offsetY);
  const aspect = options?.contentAspect;
  const fit = options?.contentFit ?? "contain";
  const targetUserId = options?.targetUserId ?? null;
  const zoomPan = options?.zoomPan ?? null;
  if (aspect && aspect.width > 0 && aspect.height > 0) {
    const toUv = (x: number, y: number) => {
      let lx = x;
      let ly = y;
      if (zoomPan && zoomPan.zoom > 1.001) {
        const rect = getContentRect(frame.width, frame.height, aspect, fit);
        if (rect) {
          const cx = rect.x + rect.width / 2;
          const cy = rect.y + rect.height / 2;
          lx = (lx - cx - zoomPan.pan.x) / zoomPan.zoom + cx;
          ly = (ly - cy - zoomPan.pan.y) / zoomPan.zoom + cy;
        }
      }
      const uv =
        canvasPointToContentUV(lx, ly, frame.width, frame.height, aspect, fit) ??
        canvasPointToNormalizedCanvas(lx, ly, frame.width, frame.height);
      return { x: uv.u, y: uv.v };
    };
    const bounds = localStroke.shapeBounds;
    return {
      ...localStroke,
      coordSpace: "contentUv",
      contentAspect: aspect,
      contentFit: fit,
      targetUserId,
      sourceCanvasSize: { width: frame.width, height: frame.height },
      points: localStroke.points.map((p) => toUv(p.x, p.y)),
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
    canvasPointToNormalizedCanvas(x, y, frame.width, frame.height);
  const bounds = localStroke.shapeBounds;
  return {
    ...localStroke,
    coordSpace: "normalizedCanvas",
    sourceCanvasSize: { width: frame.width, height: frame.height },
    points: localStroke.points.map((p) => {
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

export function projectStrokesForCapture(
  strokes: RemoteStroke[],
  canvasSize: { width: number; height: number },
  resolveOptions: (stroke: RemoteStroke) => AnnotationProjectionOptions
): RemoteStroke[] {
  return strokes.map((stroke) => {
    const opts = resolveOptions(stroke);
    const projected = projectStrokeToCanvas(
      stroke,
      canvasSize,
      opts.contentAspect ?? stroke.contentAspect,
      opts.contentFit ?? stroke.contentFit ?? "contain",
      opts.contentInsets,
      {
        measuredContentRect: opts.measuredContentRect,
        zoomPan: opts.zoomPan,
      }
    );
    return {
      ...projected,
      coordSpace: "canvasPx" as const,
      sourceCanvasSize: canvasSize,
    };
  });
}

export function projectStrokesForTarget(
  strokes: RemoteStroke[],
  sourceCanvas: { width: number; height: number },
  target: { width: number; height: number },
  options?: AnnotationProjectionOptions
): RemoteStroke[] {
  return strokes.map((stroke) =>
    projectStrokeToCanvas(
      stroke,
      target,
      options?.contentAspect ?? stroke.contentAspect,
      options?.contentFit ?? stroke.contentFit ?? "contain",
      options?.contentInsets,
      {
        measuredContentRect: options?.measuredContentRect,
        zoomPan: options?.zoomPan,
      }
    )
  );
}
