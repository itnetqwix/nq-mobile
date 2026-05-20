/**
 * Cross-platform meeting layout sync: live-stream focus (ON_VIDEO_SELECT swap)
 * and draggable PIP tile positions/sizes (MEETING_TILE_LAYOUT).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import type { PipEdge } from "./components/DraggableVideoPip";
import { PIP_HEIGHT, PIP_WIDTH } from "./components/DraggableVideoPip";
import {
  buildFullscreenPayload,
  CLIP_EVENTS,
  shouldApplyRemoteSocketEvent,
  type ClipUserInfo,
} from "./clipEvents";

export type PipTileId = "local" | "remote";

export type TileLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
  hiddenEdge: PipEdge;
};

export type MeetingLayoutPayload = {
  focusedStreamId: string | null;
  tiles: Record<PipTileId, TileLayout>;
  userInfo?: ClipUserInfo;
  sessionId?: string;
};

type Args = {
  socket: Socket | null;
  sessionId: string;
  myId: string;
  peerId: string;
  isTrainer: boolean;
};

const DEFAULT_TILE = (edge: PipEdge): TileLayout => ({
  x: 0,
  y: 0,
  w: PIP_WIDTH,
  h: PIP_HEIGHT,
  hidden: false,
  hiddenEdge: edge,
});

export function useMeetingLayout({
  socket,
  sessionId,
  myId,
  peerId,
  isTrainer,
}: Args) {
  const [focusedStreamId, setFocusedStreamId] = useState<string | null>(null);
  const [tiles, setTiles] = useState<Record<PipTileId, TileLayout>>({
    local: DEFAULT_TILE("right"),
    remote: DEFAULT_TILE("left"),
  });
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userInfo: ClipUserInfo = { from_user: myId, to_user: peerId };

  const applyPayload = useCallback((payload: MeetingLayoutPayload) => {
    if (payload.focusedStreamId !== undefined) {
      setFocusedStreamId(payload.focusedStreamId);
    }
    if (payload.tiles?.local) {
      setTiles((prev) => ({ ...prev, local: { ...prev.local, ...payload.tiles!.local } }));
    }
    if (payload.tiles?.remote) {
      setTiles((prev) => ({ ...prev, remote: { ...prev.remote, ...payload.tiles!.remote } }));
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onLayout = (payload: MeetingLayoutPayload) => {
      if (isTrainer) return;
      if (
        !shouldApplyRemoteSocketEvent(payload, {
          sessionId,
          myUserId: myId,
          isTrainer,
        })
      ) {
        return;
      }
      applyPayload(payload);
    };

    const onSwap = (payload: {
      type?: string;
      id?: string;
      sessionId?: string;
      userInfo?: ClipUserInfo;
    }) => {
      if (
        !shouldApplyRemoteSocketEvent(payload, {
          sessionId,
          myUserId: myId,
          isTrainer,
        })
      ) {
        return;
      }
      if (payload?.type !== "swap") return;
      const id = payload?.id != null ? String(payload.id) : null;
      setFocusedStreamId(id);
    };

    socket.on(CLIP_EVENTS.MEETING_TILE_LAYOUT, onLayout);
    socket.on(CLIP_EVENTS.ON_VIDEO_SELECT, onSwap);

    return () => {
      socket.off(CLIP_EVENTS.MEETING_TILE_LAYOUT, onLayout);
      socket.off(CLIP_EVENTS.ON_VIDEO_SELECT, onSwap);
    };
  }, [applyPayload, isTrainer, myId, sessionId, socket]);

  const emitLayout = useCallback(
    (patch: Partial<MeetingLayoutPayload>) => {
      if (!isTrainer || !socket) return;
      if (emitTimer.current) clearTimeout(emitTimer.current);
      emitTimer.current = setTimeout(() => {
        const payload: MeetingLayoutPayload = {
          focusedStreamId:
            patch.focusedStreamId !== undefined ? patch.focusedStreamId : focusedStreamId,
          tiles: patch.tiles ?? tiles,
          userInfo,
          sessionId,
        };
        socket.emit(CLIP_EVENTS.MEETING_TILE_LAYOUT, payload);
      }, 180);
    },
    [focusedStreamId, isTrainer, sessionId, socket, tiles, userInfo]
  );

  const focusStream = useCallback(
    (userId: string | null) => {
      setFocusedStreamId(userId);
      if (!isTrainer || !socket) return;
      socket.emit(CLIP_EVENTS.ON_VIDEO_SELECT, {
        type: "swap",
        id: userId,
        userInfo,
        sessionId,
      });
      emitLayout({ focusedStreamId: userId });
      const on = userId != null;
      socket.emit(
        CLIP_EVENTS.TOGGLE_FULL_SCREEN,
        buildFullscreenPayload({ on, userInfo, sessionId })
      );
    },
    [emitLayout, isTrainer, sessionId, socket, userInfo]
  );

  const updateTile = useCallback(
    (tile: PipTileId, patch: Partial<TileLayout>) => {
      setTiles((prev) => {
        const next = { ...prev, [tile]: { ...prev[tile], ...patch } };
        if (isTrainer) {
          emitLayout({ tiles: next });
        }
        return next;
      });
    },
    [emitLayout, isTrainer]
  );

  const stageMode =
    focusedStreamId != null ? ("liveFocus" as const) : ("default" as const);

  return {
    focusedStreamId,
    stageMode,
    tiles,
    focusStream,
    clearFocus: () => focusStream(null),
    updateTile,
    applyPayload,
  };
}
