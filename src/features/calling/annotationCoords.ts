/**
 * Map touches and strokes to normalized coordinates inside the visible video
 * patch (object-fit contain / cover). Matches web `videoAnnotationCoords.js` so
 * trainer and trainee annotations align across screen sizes.
 */

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
  | { mode: "single" }
  | { mode: "dual-locked" }
  | { mode: "dual-unlocked"; paneIndex: 0 | 1 };

export function resolveAnnotationFrame(
  target: { width: number; height: number },
  insets?: ContentInsets
): { width: number; height: number; offsetX: number; offsetY: number } {
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

/** Map clip stage layout to the video sub-rect inside the full overlay. */
export function resolveClipContentInsets(
  canvas: { width: number; height: number },
  layout: ClipAnnotationLayout
): ContentInsets {
  const timelineH = 56;
  const compactTimelineH = 42;
  const dualPaneControlsH = 46;
  if (layout.mode === "single") {
    return { bottom: timelineH, left: 0, right: 0, top: 0 };
  }
  if (layout.mode === "dual-locked") {
    return { bottom: compactTimelineH + 6, left: 0, right: 0, top: 0 };
  }
  const paneH = canvas.height / 2;
  const videoH = Math.max(1, paneH - dualPaneControlsH);
  if (layout.paneIndex === 0) {
    return { top: 0, bottom: canvas.height - videoH, left: 0, right: 0 };
  }
  return {
    top: paneH,
    bottom: canvas.height - (paneH + videoH),
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
