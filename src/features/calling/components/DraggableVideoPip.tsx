/**
 * Draggable picture-in-picture tile for live camera streams.
 * PanResponder drag (no Reanimated worklets) to avoid ref/worklet crashes.
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
import { meetingTheme } from "../meetingTheme";
import { UserBox } from "./UserBox";

export type PipEdge = "left" | "right" | "top" | "bottom";

export const PIP_WIDTH = 88;
export const PIP_HEIGHT = 124;
export const PIP_MIN_WIDTH = 72;
export const PIP_MAX_WIDTH = 140;
const DRAG_ACTIVATION_PX = 6;
/** Hide when less than half the tile remains visible (pushed off-screen). */
const HIDE_VISIBLE_RATIO = 0.5;

export type DraggableVideoPipProps = {
  tileId: "local" | "remote";
  user: CallParticipant | null;
  stream: MediaStream | null;
  isStreamOff?: boolean;
  muted?: boolean;
  fallbackLabel?: string;
  streamOffHint?: string;
  bounds: Pick<LayoutRectangle, "width" | "height"> | null;
  safeTop?: number;
  safeBottom?: number;
  pipReservedBottom?: number;
  position: { x: number; y: number };
  isHidden: boolean;
  hiddenEdge: PipEdge;
  tabLabel: string;
  onPositionChange: (pos: { x: number; y: number }) => void;
  onHide: (edge: PipEdge, lastPosition: { x: number; y: number }) => void;
  onRestore: () => void;
  disabled?: boolean;
  width?: number;
  height?: number;
  zIndex?: number;
  focusOnTap?: boolean;
  onFocus?: () => void;
  onExpand?: () => void;
  onSizeChange?: (width: number, height: number) => void;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
};

function clampPipPosition(
  x: number,
  y: number,
  bounds: Pick<LayoutRectangle, "width" | "height">,
  safeTop: number,
  reservedBottom: number,
  pipW = PIP_WIDTH,
  pipH = PIP_HEIGHT
): { x: number; y: number } {
  const maxX = Math.max(0, bounds.width - pipW);
  const maxY = Math.max(safeTop, bounds.height - reservedBottom - pipH);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(safeTop, y), maxY),
  };
}

/** Magnetize near corners so tiles settle predictably after drag. */
function snapPipToCorner(
  x: number,
  y: number,
  bounds: Pick<LayoutRectangle, "width" | "height">,
  safeTop: number,
  reservedBottom: number,
  pipW = PIP_WIDTH,
  pipH = PIP_HEIGHT
): { x: number; y: number } {
  const margin = 12;
  const corners = [
    { x: margin, y: safeTop + margin },
    { x: bounds.width - pipW - margin, y: safeTop + margin },
    { x: margin, y: bounds.height - reservedBottom - pipH - margin },
    {
      x: bounds.width - pipW - margin,
      y: bounds.height - reservedBottom - pipH - margin,
    },
  ];
  let best = corners[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of corners) {
    const d = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  if (bestDist <= 96 * 96) {
    return clampPipPosition(
      best.x,
      best.y,
      bounds,
      safeTop,
      reservedBottom,
      pipW,
      pipH
    );
  }
  return clampPipPosition(x, y, bounds, safeTop, reservedBottom, pipW, pipH);
}

/**
 * Hide PIP only when dragged off the screen (visible area drops below 50%).
 * Edge picked by which boundary the tile crossed (left/right/top/bottom).
 */
function detectHideEdge(
  x: number,
  y: number,
  bounds: Pick<LayoutRectangle, "width" | "height">,
  safeTop: number,
  reservedBottom: number,
  pipW = PIP_WIDTH,
  pipH = PIP_HEIGHT
): PipEdge | null {
  const w = bounds.width;
  const h = bounds.height;
  const playBottom = h - reservedBottom;

  const visibleW = Math.max(0, Math.min(x + pipW, w) - Math.max(x, 0));
  const visibleH = Math.max(0, Math.min(y + pipH, playBottom) - Math.max(y, safeTop));
  const visibleArea = visibleW * visibleH;
  const tileArea = pipW * pipH;
  if (tileArea <= 0) return null;
  if (visibleArea / tileArea >= HIDE_VISIBLE_RATIO) return null;

  const offLeft = Math.max(0, -x);
  const offRight = Math.max(0, x + pipW - w);
  const offTop = Math.max(0, safeTop - y);
  const offBottom = Math.max(0, y + pipH - playBottom);
  const min = Math.min(offLeft, offRight, offTop, offBottom);
  if (min === offLeft) return "left";
  if (min === offRight) return "right";
  if (min === offTop) return "top";
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
  user,
  stream,
  isStreamOff,
  muted,
  fallbackLabel,
  streamOffHint,
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
  width = PIP_WIDTH,
  height = PIP_HEIGHT,
  zIndex = 45,
  focusOnTap = false,
  onFocus,
  onExpand,
}: DraggableVideoPipProps) {
  const reservedBottom = pipReservedBottom ?? safeBottom + 80;
  const pan = useRef(new Animated.ValueXY(position)).current;
  const dragStart = useRef({ x: position.x, y: position.y });
  const releasePos = useRef(position);
  const didDragRef = useRef(false);

  React.useEffect(() => {
    pan.setValue({ x: position.x, y: position.y });
    dragStart.current = position;
    releasePos.current = position;
  }, [position.x, position.y, pan]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled && !isHidden,
        onMoveShouldSetPanResponder: (_, gesture) =>
          !disabled &&
          !isHidden &&
          (didDragRef.current ||
            Math.abs(gesture.dx) > DRAG_ACTIVATION_PX ||
            Math.abs(gesture.dy) > DRAG_ACTIVATION_PX),
        onPanResponderGrant: () => {
          didDragRef.current = false;
          dragStart.current = { ...position };
        },
        onPanResponderMove: (_, gesture) => {
          if (
            Math.abs(gesture.dx) > DRAG_ACTIVATION_PX ||
            Math.abs(gesture.dy) > DRAG_ACTIVATION_PX
          ) {
            didDragRef.current = true;
          }
          pan.setValue({
            x: dragStart.current.x + gesture.dx,
            y: dragStart.current.y + gesture.dy,
          });
        },
        onPanResponderRelease: (_, gesture) => {
          const rawX = dragStart.current.x + gesture.dx;
          const rawY = dragStart.current.y + gesture.dy;
          const moved = didDragRef.current;

          if (!moved && focusOnTap && onFocus) {
            pan.setValue({ x: position.x, y: position.y });
            onFocus();
            return;
          }

          if (!bounds) {
            onPositionChange({ x: rawX, y: rawY });
            return;
          }

          const edge = detectHideEdge(
            rawX,
            rawY,
            bounds,
            safeTop,
            reservedBottom,
            width,
            height
          );
          if (edge) {
            onHide(edge, releasePos.current);
            pan.setValue({ x: releasePos.current.x, y: releasePos.current.y });
            return;
          }

          const clamped = snapPipToCorner(
            rawX,
            rawY,
            bounds,
            safeTop,
            reservedBottom,
            width,
            height
          );
          releasePos.current = clamped;
          pan.setValue(clamped);
          onPositionChange(clamped);
        },
        onPanResponderTerminate: (_, gesture) => {
          const rawX = dragStart.current.x + gesture.dx;
          const rawY = dragStart.current.y + gesture.dy;
          if (!bounds) return;
          const clamped = snapPipToCorner(
            rawX,
            rawY,
            bounds,
            safeTop,
            reservedBottom,
            width,
            height
          );
          pan.setValue(clamped);
          onPositionChange(clamped);
        },
      }),
    [
      bounds,
      disabled,
      focusOnTap,
      height,
      isHidden,
      onFocus,
      onHide,
      onPositionChange,
      pan,
      position.x,
      position.y,
      reservedBottom,
      safeTop,
      width,
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
          <Ionicons name="chevron-back" size={16} color="#fff" />
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
          width,
          height,
          zIndex,
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
        streamOffHint={streamOffHint}
        style={styles.tileInner}
      />
      {onExpand ? (
        <Pressable
          style={styles.expandBtn}
          onPress={onExpand}
          hitSlop={8}
          accessibilityLabel={`Expand ${tabLabel} video`}
        >
          <Ionicons name="expand-outline" size={16} color="#fff" />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  tileInner: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: meetingTheme.border,
    backgroundColor: meetingTheme.videoPlaceholder,
  },
  expandBtn: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 4,
  },
  edgeTabWrap: {
    position: "absolute",
    zIndex: 56,
  },
  edgeTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.82)",
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
