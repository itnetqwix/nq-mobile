/**
 * Draggable picture-in-picture tile for live camera streams.
 * Drag off-screen to hide; tap the edge tab to restore the last visible position.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
} from "react-native";
import type { MediaStream } from "react-native-webrtc";

import type { CallParticipant } from "../types";
import { UserBox } from "./UserBox";

export type PipEdge = "left" | "right" | "top" | "bottom";

export const PIP_WIDTH = 110;
export const PIP_HEIGHT = 160;
const TAP_SLOP_PX = 8;
const HIDE_VISIBLE_RATIO = 0.25;

export type DraggableVideoPipProps = {
  tileId: "local" | "remote";
  user: CallParticipant | null;
  stream: MediaStream | null;
  isStreamOff?: boolean;
  muted?: boolean;
  fallbackLabel?: string;
  /** Parent meeting surface dimensions. */
  bounds: Pick<LayoutRectangle, "width" | "height"> | null;
  /** Safe-area padding inside bounds. */
  safeTop?: number;
  safeBottom?: number;
  /** Bottom reserve for action bar + clip timeline (PIPs cannot drag below). */
  pipReservedBottom?: number;
  position: { x: number; y: number };
  isHidden: boolean;
  hiddenEdge: PipEdge;
  tabLabel: string;
  onPositionChange: (pos: { x: number; y: number }) => void;
  onHide: (edge: PipEdge, lastPosition: { x: number; y: number }) => void;
  onRestore: () => void;
  disabled?: boolean;
};

function clampPipPosition(
  x: number,
  y: number,
  bounds: Pick<LayoutRectangle, "width" | "height">,
  safeTop: number,
  reservedBottom: number
): { x: number; y: number } {
  const maxX = Math.max(0, bounds.width - PIP_WIDTH);
  const maxY = Math.max(safeTop, bounds.height - reservedBottom - PIP_HEIGHT);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(safeTop, y), maxY),
  };
}

function detectHideEdge(
  x: number,
  y: number,
  bounds: Pick<LayoutRectangle, "width" | "height">,
  safeTop: number,
  reservedBottom: number
): PipEdge | null {
  const w = bounds.width;
  const h = bounds.height;
  const visibleW = Math.min(x + PIP_WIDTH, w) - Math.max(x, 0);
  const visibleH = Math.min(y + PIP_HEIGHT, h - reservedBottom) - Math.max(y, safeTop);
  const ratioW = visibleW / PIP_WIDTH;
  const ratioH = visibleH / PIP_HEIGHT;
  if (ratioW >= HIDE_VISIBLE_RATIO && ratioH >= HIDE_VISIBLE_RATIO) return null;

  const distLeft = x;
  const distRight = w - (x + PIP_WIDTH);
  const distTop = y - safeTop;
  const distBottom = h - reservedBottom - (y + PIP_HEIGHT);
  const min = Math.min(distLeft, distRight, distTop, distBottom);
  if (min === distLeft) return "left";
  if (min === distRight) return "right";
  if (min === distTop) return "top";
  return "bottom";
}

export function defaultPipPosition(
  tileId: "local" | "remote",
  bounds: Pick<LayoutRectangle, "width" | "height">,
  safeTop: number,
  reservedBottom: number
): { x: number; y: number } {
  const y = Math.max(safeTop + 8, bounds.height - reservedBottom - PIP_HEIGHT);
  if (tileId === "local") {
    return { x: bounds.width - PIP_WIDTH - 16, y };
  }
  return { x: 16, y };
}

export function DraggableVideoPip({
  tileId,
  user,
  stream,
  isStreamOff,
  muted,
  fallbackLabel,
  bounds,
  safeTop = 0,
  safeBottom = 0,
  pipReservedBottom,
  position,
  isHidden,
  hiddenEdge,
  tabLabel,
  onPositionChange,
  onHide,
  onRestore,
  disabled,
}: DraggableVideoPipProps) {
  const reservedBottom = pipReservedBottom ?? safeBottom + 160;
  const pan = useRef(new Animated.ValueXY(position)).current;
  const dragStart = useRef({ x: 0, y: 0 });
  const releasePos = useRef(position);

  React.useEffect(() => {
    pan.setValue({ x: position.x, y: position.y });
    releasePos.current = position;
  }, [position.x, position.y, pan]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled && !isHidden,
        onMoveShouldSetPanResponder: () => !disabled && !isHidden,
        onPanResponderGrant: () => {
          dragStart.current = {
            x: (pan.x as Animated.Value & { _value?: number })._value ?? position.x,
            y: (pan.y as Animated.Value & { _value?: number })._value ?? position.y,
          };
          pan.setOffset({
            x: (pan.x as Animated.Value & { _value?: number })._value ?? 0,
            y: (pan.y as Animated.Value & { _value?: number })._value ?? 0,
          });
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gesture) => {
          pan.flattenOffset();
          const x = dragStart.current.x + gesture.dx;
          const y = dragStart.current.y + gesture.dy;
          const moved = Math.hypot(gesture.dx, gesture.dy);

          if (moved < TAP_SLOP_PX) {
            pan.setValue({ x: position.x, y: position.y });
            return;
          }

          if (!bounds) {
            onPositionChange({ x, y });
            return;
          }

          const clamped = clampPipPosition(x, y, bounds, safeTop, reservedBottom);
          const edge = detectHideEdge(
            clamped.x,
            clamped.y,
            bounds,
            safeTop,
            reservedBottom
          );
          if (edge) {
            onHide(edge, releasePos.current);
            pan.setValue({ x: releasePos.current.x, y: releasePos.current.y });
            return;
          }

          releasePos.current = clamped;
          pan.setValue(clamped);
          onPositionChange(clamped);
        },
      }),
    [
      bounds,
      disabled,
      isHidden,
      onHide,
      onPositionChange,
      pan,
      position.x,
      position.y,
      reservedBottom,
      safeTop,
    ]
  );

  if (!bounds) return null;

  if (isHidden) {
    const tabPosStyle =
      hiddenEdge === "left"
        ? { left: 4, top: bounds.height * 0.38 }
        : hiddenEdge === "right"
          ? { right: 4, top: bounds.height * 0.38 }
          : hiddenEdge === "top"
            ? { top: safeTop + 6, left: (bounds.width - 96) / 2 }
            : { bottom: reservedBottom + 8, left: (bounds.width - 96) / 2 };

    return (
      <Pressable
        style={[styles.edgeTabWrap, tabPosStyle]}
        onPress={onRestore}
        accessibilityRole="button"
        accessibilityLabel={`Show ${tabLabel} camera`}
      >
        <View style={styles.edgeTab}>
          <Ionicons name="videocam" size={16} color="#fff" />
          <Text style={styles.edgeTabText} numberOfLines={1}>
            {tabLabel}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
      {...responder.panHandlers}
      accessibilityLabel={`${tabLabel} camera preview`}
    >
      <UserBox
        user={user}
        stream={stream}
        isStreamOff={isStreamOff}
        muted={muted}
        fallbackLabel={fallbackLabel}
        style={styles.tileInner}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: "absolute",
    left: 0,
    top: 0,
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
    zIndex: 60,
  },
  tileInner: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.45)",
  },
  edgeTabWrap: {
    position: "absolute",
    zIndex: 56,
  },
  edgeTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,128,0.88)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    maxWidth: 120,
  },
  edgeTabText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
