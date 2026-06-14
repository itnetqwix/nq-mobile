import type { PipEdge } from "./components/DraggableVideoPip";
import type { TileLayout } from "./useMeetingLayout";

const PIP_WIDTH = 88;
const PIP_HEIGHT = 124;

/** Roomier tiles during clip review (both cameras visible over the stage). */
export const CLIP_MODE_PIP = { w: 108, h: 132 };

export function resolveTilePosition(
  tile: TileLayout,
  bounds: { width: number; height: number } | null,
  fallback: { x: number; y: number }
): { x: number; y: number } {
  if (bounds && tile.nx != null && tile.ny != null) {
    return { x: tile.nx * bounds.width, y: tile.ny * bounds.height };
  }
  if (typeof tile.x === "number" && typeof tile.y === "number") {
    return { x: tile.x, y: tile.y };
  }
  return fallback;
}

export function resolveTileSize(
  tile: TileLayout,
  bounds: { width: number; height: number } | null,
  fallback: { w: number; h: number }
): { w: number; h: number } {
  if (bounds && tile.nw != null && tile.nh != null) {
    return { w: tile.nw * bounds.width, h: tile.nh * bounds.height };
  }
  return {
    w: tile.w > 0 ? tile.w : fallback.w,
    h: tile.h > 0 ? tile.h : fallback.h,
  };
}

export function defaultLocalPipLayout(
  bounds: { width: number; height: number },
  safeTop: number,
  pipReservedBottom: number
): { position: { x: number; y: number }; size: { w: number; h: number }; hiddenEdge: PipEdge } {
  const y = Math.max(safeTop + 8, bounds.height - pipReservedBottom - PIP_HEIGHT);
  return {
    position: { x: bounds.width - PIP_WIDTH - 16, y },
    size: { w: PIP_WIDTH, h: PIP_HEIGHT },
    hiddenEdge: "right",
  };
}

export function defaultClipModeLocalPipLayout(
  bounds: { width: number; height: number },
  safeTop: number,
  pipReservedBottom: number
): { position: { x: number; y: number }; size: { w: number; h: number }; hiddenEdge: PipEdge } {
  const y = Math.max(
    safeTop + 8,
    bounds.height - pipReservedBottom - CLIP_MODE_PIP.h
  );
  return {
    position: { x: bounds.width - CLIP_MODE_PIP.w - 14, y },
    size: { ...CLIP_MODE_PIP },
    hiddenEdge: "right",
  };
}

export function defaultClipModeRemotePipLayout(
  bounds: { width: number; height: number },
  safeTop: number,
  pipReservedBottom: number
): { position: { x: number; y: number }; size: { w: number; h: number }; hiddenEdge: PipEdge } {
  const y = Math.max(
    safeTop + 8,
    bounds.height - pipReservedBottom - CLIP_MODE_PIP.h
  );
  return {
    position: { x: 14, y },
    size: { ...CLIP_MODE_PIP },
    hiddenEdge: "left",
  };
}
