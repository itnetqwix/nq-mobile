/**
 * Map touches and strokes to normalized coordinates inside the visible video
 * patch (object-fit contain / cover). Matches web `videoAnnotationCoords.js` so
 * trainer and trainee annotations align across screen sizes.
 */

import type { PanPoint } from "./clipZoomPanUtils";

export type ContentRect = { x: number; y: number; width: number; height: number };

export type ContentAspect = { width: number; height: number };

export type AnnotationFitMode = "contain" | "cover";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function clampUV(uv: { u: number; v: number } | null | undefined): { u: number; v: number } | null {
  if (!uv || typeof uv.u !== "number" || typeof uv.v !== "number") return null;
  return { u: clamp01(uv.u), v: clamp01(uv.v) };
}

/** Visible video region for object-fit: contain (lesson clips). */
export function getObjectFitContainRect(
  frameW: number,
  frameH: number,
  contentW: number,
  contentH: number
): ContentRect | null {
  if (frameW <= 0 || frameH <= 0 || contentW <= 0 || contentH <= 0) return null;
  const scale = Math.min(frameW / contentW, frameH / contentH);
  const dispW = contentW * scale;
  const dispH = contentH * scale;
  return {
    x: (frameW - dispW) / 2,
    y: (frameH - dispH) / 2,
    width: dispW,
    height: dispH,
  };
}

/** Visible video region for object-fit: cover (live WebRTC tiles). */
export function getObjectFitCoverRect(
  frameW: number,
  frameH: number,
  contentW: number,
  contentH: number
): ContentRect | null {
  if (frameW <= 0 || frameH <= 0 || contentW <= 0 || contentH <= 0) return null;
  const scale = Math.max(frameW / contentW, frameH / contentH);
  const dispW = contentW * scale;
  const dispH = contentH * scale;
  return {
    x: (frameW - dispW) / 2,
    y: (frameH - dispH) / 2,
    width: dispW,
    height: dispH,
  };
}

export function getContentRect(
  frameW: number,
  frameH: number,
  aspect: ContentAspect,
  fit: AnnotationFitMode
): ContentRect | null {
  return fit === "cover"
    ? getObjectFitCoverRect(frameW, frameH, aspect.width, aspect.height)
    : getObjectFitContainRect(frameW, frameH, aspect.width, aspect.height);
}

/** Overlay-local pixel → normalized UV in visible content [0,1]². */
export function canvasPointToContentUV(
  x: number,
  y: number,
  frameW: number,
  frameH: number,
  aspect: ContentAspect,
  fit: AnnotationFitMode
): { u: number; v: number } | null {
  const rect = getContentRect(frameW, frameH, aspect, fit);
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return clampUV({
    u: (x - rect.x) / rect.width,
    v: (y - rect.y) / rect.height,
  });
}

/** Normalized UV → overlay-local pixel for Skia drawing. */
export function contentUVToCanvasPoint(
  u: number,
  v: number,
  frameW: number,
  frameH: number,
  aspect: ContentAspect,
  fit: AnnotationFitMode
): { x: number; y: number } | null {
  const rect = getContentRect(frameW, frameH, aspect, fit);
  if (!rect) return null;
  const uv = clampUV({ u, v });
  if (!uv) return null;
  return {
    x: rect.x + uv.u * rect.width,
    y: rect.y + uv.v * rect.height,
  };
}

/** Fallback when content aspect is unknown: normalize to full overlay. */
export function canvasPointToNormalizedCanvas(
  x: number,
  y: number,
  frameW: number,
  frameH: number
): { u: number; v: number } {
  return {
    u: clamp01(frameW > 0 ? x / frameW : 0),
    v: clamp01(frameH > 0 ? y / frameH : 0),
  };
}

export type ContentInsets = { top?: number; bottom?: number; left?: number; right?: number };

export type ClipAnnotationLayout =
  | { mode: "single"; trainerControls?: boolean }
  | { mode: "dual-locked"; paneIndex: 0 | 1; trainerControls?: boolean }
  | {
      mode: "dual-unlocked";
      paneIndex: 0 | 1;
      trainerControls?: boolean;
      focused?: boolean;
    };

export type AnnotationMappingFrame = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

export function resolveAnnotationFrame(
  target: { width: number; height: number },
  insets?: ContentInsets
): AnnotationMappingFrame {
  const top = insets?.top ?? 0;
  const left = insets?.left ?? 0;
  const right = insets?.right ?? 0;
  const bottom = insets?.bottom ?? 0;
  return {
    width: Math.max(1, target.width - left - right),
    height: Math.max(1, target.height - top - bottom),
    offsetX: left,
    offsetY: top,
  };
}

export function insetsFromMeasuredRect(
  canvas: { width: number; height: number },
  rect: ContentRect | null | undefined
): ContentInsets | undefined {
  if (!rect || rect.width <= 0 || rect.height <= 0) return undefined;
  return {
    top: rect.y,
    left: rect.x,
    bottom: Math.max(0, canvas.height - rect.y - rect.height),
    right: Math.max(0, canvas.width - rect.x - rect.width),
  };
}

export function resolveAnnotationMappingFrame(
  canvas: { width: number; height: number },
  options?: {
    contentInsets?: ContentInsets;
    measuredContentRect?: ContentRect | null;
  }
): AnnotationMappingFrame {
  if (options?.measuredContentRect) {
    const r = options.measuredContentRect;
    return {
      width: Math.max(1, r.width),
      height: Math.max(1, r.height),
      offsetX: r.x,
      offsetY: r.y,
    };
  }
  return resolveAnnotationFrame(canvas, options?.contentInsets);
}

/** Map clip stage layout to the video sub-rect inside the full overlay (analytic fallback). */
export function resolveClipContentInsets(
  canvas: { width: number; height: number },
  layout: ClipAnnotationLayout
): ContentInsets {
  const trainerControls = layout.trainerControls !== false;
  const timelineH = trainerControls ? 68 : 0;
  const compactTimelineH = trainerControls ? 52 : 0;
  const dualPaneControlsH = trainerControls ? 58 : 0;
  const stackGap = 4;

  if (layout.mode === "single") {
    return { bottom: timelineH, left: 0, right: 0, top: 0 };
  }

  if (layout.mode === "dual-locked") {
    const controlsH = compactTimelineH + 6;
    const stackH = Math.max(1, canvas.height - controlsH - stackGap);
    const paneH = stackH / 2;
    if (layout.paneIndex === 0) {
      return { top: 0, bottom: canvas.height - paneH, left: 0, right: 0 };
    }
    return {
      top: paneH + stackGap,
      bottom: controlsH,
      left: 0,
      right: 0,
    };
  }

  if (layout.focused) {
    return {
      top: 0,
      bottom: trainerControls ? dualPaneControlsH : 0,
      left: 0,
      right: 0,
    };
  }

  const paneH = (canvas.height - stackGap) / 2;
  const videoH = Math.max(1, paneH - dualPaneControlsH);
  if (layout.paneIndex === 0) {
    return { top: 0, bottom: canvas.height - videoH, left: 0, right: 0 };
  }
  return {
    top: paneH + stackGap,
    bottom: canvas.height - (paneH + stackGap + videoH),
    left: 0,
    right: 0,
  };
}

export function normalizedCanvasToPoint(
  u: number,
  v: number,
  frameW: number,
  frameH: number
): { x: number; y: number } {
  const uv = clampUV({ u, v }) ?? { u: 0, v: 0 };
  return { x: uv.u * frameW, y: uv.v * frameH };
}

/** Inverse zoom/pan before mapping overlay touch to content UV. */
export function overlayPointToLocalVideoPoint(
  x: number,
  y: number,
  frame: AnnotationMappingFrame,
  aspect: ContentAspect,
  fit: AnnotationFitMode,
  zoomPan?: { zoom: number; pan: PanPoint } | null
): { x: number; y: number } {
  let lx = x - frame.offsetX;
  let ly = y - frame.offsetY;
  const z = zoomPan?.zoom ?? 1;
  if (z > 1.001 && zoomPan) {
    const rect = getContentRect(frame.width, frame.height, aspect, fit);
    if (rect) {
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      lx = (lx - cx - zoomPan.pan.x) / z + cx;
      ly = (ly - cy - zoomPan.pan.y) / z + cy;
    }
  }
  return { x: lx, y: ly };
}

/** Apply zoom/pan when projecting content UV back to overlay pixels. */
export function localVideoPointToOverlayPoint(
  lx: number,
  ly: number,
  frame: AnnotationMappingFrame,
  aspect: ContentAspect,
  fit: AnnotationFitMode,
  zoomPan?: { zoom: number; pan: PanPoint } | null
): { x: number; y: number } {
  const z = zoomPan?.zoom ?? 1;
  let px = lx;
  let py = ly;
  if (z > 1.001 && zoomPan) {
    const rect = getContentRect(frame.width, frame.height, aspect, fit);
    if (rect) {
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      px = (lx - cx) * z + cx + zoomPan.pan.x;
      py = (ly - cy) * z + cy + zoomPan.pan.y;
    }
  }
  return { x: px + frame.offsetX, y: py + frame.offsetY };
}
