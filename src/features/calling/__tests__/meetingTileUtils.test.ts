import {
  resolveTilePosition,
  resolveTileSize,
} from "../meetingTileUtils";
import type { TileLayout } from "../useMeetingLayout";

describe("meetingTileUtils", () => {
  const bounds = { width: 400, height: 800 };

  it("resolves normalized tile position across screen sizes", () => {
    const tile: TileLayout = {
      x: 0,
      y: 0,
      w: 88,
      h: 124,
      hidden: false,
      hiddenEdge: "right",
      nx: 0.75,
      ny: 0.12,
    };
    expect(resolveTilePosition(tile, bounds, { x: 1, y: 2 })).toEqual({
      x: 300,
      y: 96,
    });
  });

  it("falls back when normalized coords are missing", () => {
    const tile: TileLayout = {
      x: 22,
      y: 44,
      w: 88,
      h: 124,
      hidden: false,
      hiddenEdge: "right",
    };
    expect(resolveTilePosition(tile, bounds, { x: 0, y: 0 })).toEqual({
      x: 22,
      y: 44,
    });
  });

  it("resolves normalized tile size for Android/iOS parity", () => {
    const tile: TileLayout = {
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      hidden: false,
      hiddenEdge: "right",
      nw: 0.22,
      nh: 0.155,
    };
    expect(resolveTileSize(tile, bounds, { w: 88, h: 124 })).toEqual({
      w: 88,
      h: 124,
    });
  });
});
