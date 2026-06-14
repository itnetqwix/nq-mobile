import type { PipEdge } from "./components/DraggableVideoPip";
import type { TileLayout } from "./useMeetingLayout";

const PIP_WIDTH = 88;
const PIP_HEIGHT = 124;

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
