/**
 * Local PIP positions + hide state, merged with trainer-synced hiddenVideos from useClipSync.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import type { PipEdge } from "./components/DraggableVideoPip";
import { defaultPipPosition } from "./components/DraggableVideoPip";
import type { HiddenVideosMap, VideoHideType } from "./useClipSync";
import type { TileLayout } from "./useMeetingLayout";

export type PipTileId = "local" | "remote";

type TileState = {
  position: { x: number; y: number } | null;
  hiddenEdge: PipEdge;
  /** Trainee-only local hide (no socket). */
  locallyHidden: boolean;
};

type Bounds = { width: number; height: number };

type Args = {
  isTrainer: boolean;
  hiddenVideos: HiddenVideosMap;
  setVideoHidden: (videoType: VideoHideType, hidden: boolean) => void;
  bounds: Bounds | null;
  safeTop: number;
  safeBottom: number;
  pipReservedBottom: number;
};

function roleForTile(tile: PipTileId, isTrainer: boolean): VideoHideType {
  if (isTrainer) return tile === "local" ? "teacher" : "student";
  return tile === "local" ? "student" : "teacher";
}

function syncedHiddenForTile(
  tile: PipTileId,
  isTrainer: boolean,
  hiddenVideos: HiddenVideosMap
): boolean {
  if (hiddenVideos.teacher && hiddenVideos.student) return true;
  if (tile === "local") {
    return isTrainer ? hiddenVideos.teacher : hiddenVideos.student;
  }
  return isTrainer ? hiddenVideos.student : hiddenVideos.teacher;
}

export function useVideoPipLayout({
  isTrainer,
  hiddenVideos,
  setVideoHidden,
  bounds,
  safeTop,
  safeBottom,
  pipReservedBottom,
}: Args) {
  const [local, setLocal] = useState<TileState>({
    position: null,
    hiddenEdge: "right",
    locallyHidden: false,
  });
  const [remote, setRemote] = useState<TileState>({
    position: null,
    hiddenEdge: "left",
    locallyHidden: false,
  });

  useEffect(() => {
    if (!bounds) return;
    const layoutRect = { width: bounds.width, height: bounds.height, x: 0, y: 0 };
    setLocal((prev) => ({
      ...prev,
      position:
        prev.position ?? defaultPipPosition("local", layoutRect, safeTop, pipReservedBottom),
    }));
    setRemote((prev) => ({
      ...prev,
      position:
        prev.position ?? defaultPipPosition("remote", layoutRect, safeTop, pipReservedBottom),
    }));
  }, [bounds, safeTop, pipReservedBottom]);

  const getTileState = useCallback(
    (tile: PipTileId) => (tile === "local" ? local : remote),
    [local, remote]
  );

  const setTileState = useCallback((tile: PipTileId, patch: Partial<TileState>) => {
    if (tile === "local") setLocal((prev) => ({ ...prev, ...patch }));
    else setRemote((prev) => ({ ...prev, ...patch }));
  }, []);

  const isTileHidden = useCallback(
    (tile: PipTileId) => {
      const state = getTileState(tile);
      return state.locallyHidden || syncedHiddenForTile(tile, isTrainer, hiddenVideos);
    },
    [getTileState, hiddenVideos, isTrainer]
  );

  const hideTile = useCallback(
    (tile: PipTileId, edge: PipEdge, lastPosition: { x: number; y: number }) => {
      setTileState(tile, { hiddenEdge: edge, position: lastPosition });

      if (isTrainer) {
        setVideoHidden(roleForTile(tile, isTrainer), true);
        return;
      }

      setTileState(tile, { locallyHidden: true });
    },
    [isTrainer, setTileState, setVideoHidden]
  );

  const restoreTile = useCallback(
    (tile: PipTileId) => {
      setTileState(tile, { locallyHidden: false });
      if (isTrainer) {
        setVideoHidden(roleForTile(tile, isTrainer), false);
      }
    },
    [isTrainer, setTileState, setVideoHidden]
  );

  const updatePosition = useCallback(
    (tile: PipTileId, position: { x: number; y: number }) => {
      setTileState(tile, { position });
    },
    [setTileState]
  );

  const pipLayout = useMemo(
    () => ({
      local: {
        position: local.position ?? { x: 0, y: 0 },
        isHidden: isTileHidden("local"),
        hiddenEdge: local.hiddenEdge,
      },
      remote: {
        position: remote.position ?? { x: 0, y: 0 },
        isHidden: isTileHidden("remote"),
        hiddenEdge: remote.hiddenEdge,
      },
    }),
    [isTileHidden, local, remote]
  );

  /** Trainer `local`/`remote` are mirrored onto trainee `remote`/`local`. */
  const mapTrainerTile = useCallback(
    (trainerTile: PipTileId): PipTileId => {
      if (isTrainer) return trainerTile;
      return trainerTile === "local" ? "remote" : "local";
    },
    [isTrainer]
  );

  const resolvePosition = useCallback(
    (t: TileLayout, bounds: Bounds | null): { x: number; y: number } | null => {
      if (bounds && t.nx != null && t.ny != null) {
        return { x: t.nx * bounds.width, y: t.ny * bounds.height };
      }
      if (typeof t.x === "number" && typeof t.y === "number") {
        return { x: t.x, y: t.y };
      }
      return null;
    },
    []
  );

  /** Apply trainer-synced tile layout (trainee / reconnect). */
  const applyRemoteTiles = useCallback(
    (tiles: Record<PipTileId, TileLayout>) => {
      (["local", "remote"] as PipTileId[]).forEach((trainerTile) => {
        const tile = mapTrainerTile(trainerTile);
        const t = tiles[trainerTile];
        if (!t) return;
        const pos = resolvePosition(t, bounds);
        if (pos) {
          setTileState(tile, { position: { x: pos.x, y: pos.y } });
        }
        if (t.hiddenEdge) {
          setTileState(tile, { hiddenEdge: t.hiddenEdge });
        }
        if (t.hidden) {
          setTileState(tile, {
            locallyHidden: !isTrainer,
            hiddenEdge: t.hiddenEdge ?? "right",
          });
          if (isTrainer) {
            setVideoHidden(roleForTile(tile, isTrainer), true);
          }
        } else {
          setTileState(tile, { locallyHidden: false });
          if (isTrainer) {
            setVideoHidden(roleForTile(tile, isTrainer), false);
          }
        }
      });
    },
    [bounds, isTrainer, mapTrainerTile, resolvePosition, setTileState, setVideoHidden]
  );

  return {
    pipLayout,
    hideTile,
    restoreTile,
    updatePosition,
    isTileHidden,
    applyRemoteTiles,
  };
}
