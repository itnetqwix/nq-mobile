/**
 * Draggable picture-in-picture tile for live camera streams.
 * Drag off-screen to hide; use the expand button (not tap) to focus on main stage during clip mode.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutRectangle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
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
const HIDE_VISIBLE_RATIO = 0.5;

export type DraggableVideoPipProps = {
  tileId: "local" | "remote";
  user: CallParticipant | null;
  stream: MediaStream | null;
  isStreamOff?: boolean;
  muted?: boolean;
  fallbackLabel?: string;
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
  const visibleW = Math.min(x + pipW, w) - Math.max(x, 0);
  const visibleH = Math.min(y + pipH, h - reservedBottom) - Math.max(y, safeTop);
  const ratioW = visibleW / pipW;
  const ratioH = visibleH / pipH;
  if (ratioW >= HIDE_VISIBLE_RATIO && ratioH >= HIDE_VISIBLE_RATIO) return null;

  const distLeft = Math.max(0, -x);
  const distRight = Math.max(0, x + pipW - w);
  const distTop = Math.max(0, safeTop - y);
  const distBottom = Math.max(0, y + pipH - (h - reservedBottom));
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
  width = PIP_WIDTH,
  height = PIP_HEIGHT,
  zIndex = 45,
  focusOnTap = false,
  onFocus,
  onExpand,
  onSizeChange,
  resizable = false,
  minWidth = PIP_MIN_WIDTH,
  maxWidth = PIP_MAX_WIDTH,
}: DraggableVideoPipProps) {
  const reservedBottom = pipReservedBottom ?? safeBottom + 80;
  const translateX = useSharedValue(position.x);
  const translateY = useSharedValue(position.y);
  const startX = useSharedValue(position.x);
  const startY = useSharedValue(position.y);
  const didDrag = useSharedValue(false);
  const releasePosRef = React.useRef(position);

  useEffect(() => {
    translateX.value = position.x;
    translateY.value = position.y;
    startX.value = position.x;
    startY.value = position.y;
    releasePosRef.current = position;
  }, [position.x, position.y, startX, startY, translateX, translateY]);

  const handleRelease = useMemo(
    () => (rawX: number, rawY: number, moved: boolean) => {
      if (!moved && focusOnTap && onFocus) {
        translateX.value = position.x;
        translateY.value = position.y;
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
        onHide(edge, releasePosRef.current);
        translateX.value = releasePosRef.current.x;
        translateY.value = releasePosRef.current.y;
        return;
      }
      const clamped = clampPipPosition(
        rawX,
        rawY,
        bounds,
        safeTop,
        reservedBottom,
        width,
        height
      );
      releasePosRef.current = clamped;
      translateX.value = clamped.x;
      translateY.value = clamped.y;
      onPositionChange(clamped);
    },
    [
      bounds,
      focusOnTap,
      height,
      onFocus,
      onHide,
      onPositionChange,
      position.x,
      position.y,
      reservedBottom,
      safeTop,
      translateX,
      translateY,
      width,
    ]
  );

  const panGesture = useMemo(() => {
    if (disabled || isHidden) return null;
    return Gesture.Pan()
      .minDistance(DRAG_ACTIVATION_PX)
      .onBegin(() => {
        didDrag.value = false;
        startX.value = translateX.value;
        startY.value = translateY.value;
      })
      .onUpdate((e) => {
        if (Math.abs(e.translationX) > DRAG_ACTIVATION_PX || Math.abs(e.translationY) > DRAG_ACTIVATION_PX) {
          didDrag.value = true;
        }
        translateX.value = startX.value + e.translationX;
        translateY.value = startY.value + e.translationY;
      })
      .onEnd((e) => {
        const rawX = startX.value + e.translationX;
        const rawY = startY.value + e.translationY;
        runOnJS(handleRelease)(rawX, rawY, didDrag.value);
      });
  }, [
    didDrag,
    disabled,
    handleRelease,
    isHidden,
    startX,
    startY,
    translateX,
    translateY,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

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

  const tile = (
    <Animated.View
      style={[
        styles.tile,
        { width, height, zIndex },
        animatedStyle,
      ]}
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
      {resizable && onSizeChange ? (
        <Pressable
          style={styles.resizeHandle}
          onPress={() => undefined}
          accessibilityLabel="Resize (disabled in clip mode)"
        >
          <Ionicons name="resize-outline" size={14} color="#fff" />
        </Pressable>
      ) : null}
    </Animated.View>
  );

  if (panGesture) {
    return <GestureDetector gesture={panGesture}>{tile}</GestureDetector>;
  }
  return tile;
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
  resizeHandle: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
