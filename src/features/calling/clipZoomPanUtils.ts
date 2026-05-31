/** Normalized clip pan so trainee panes match trainer crop across screen sizes. */

export type PanPoint = { x: number; y: number };

export function maxPanOffset(
  frameW: number,
  frameH: number,
  zoom: number
): { maxX: number; maxY: number } {
  if (frameW <= 0 || frameH <= 0 || zoom <= 1) {
    return { maxX: 0, maxY: 0 };
  }
  return {
    maxX: (frameW * (zoom - 1)) / 2,
    maxY: (frameH * (zoom - 1)) / 2,
  };
}

export function panToNormalized(
  pan: PanPoint,
  frameW: number,
  frameH: number,
  zoom: number
): { panNx: number; panNy: number } {
  const { maxX, maxY } = maxPanOffset(frameW, frameH, zoom);
  if (maxX <= 0 || maxY <= 0) return { panNx: 0, panNy: 0 };
  return {
    panNx: Math.max(-1, Math.min(1, pan.x / maxX)),
    panNy: Math.max(-1, Math.min(1, pan.y / maxY)),
  };
}

export function panFromNormalized(
  panNx: number,
  panNy: number,
  frameW: number,
  frameH: number,
  zoom: number
): PanPoint {
  const { maxX, maxY } = maxPanOffset(frameW, frameH, zoom);
  return {
    x: panNx * maxX,
    y: panNy * maxY,
  };
}

export function clampPanForFrame(
  pan: PanPoint,
  frameW: number,
  frameH: number,
  zoom: number
): PanPoint {
  const { maxX, maxY } = maxPanOffset(frameW, frameH, zoom);
  if (maxX <= 0 || maxY <= 0) return { x: 0, y: 0 };
  return {
    x: Math.max(-maxX, Math.min(maxX, pan.x)),
    y: Math.max(-maxY, Math.min(maxY, pan.y)),
  };
}
