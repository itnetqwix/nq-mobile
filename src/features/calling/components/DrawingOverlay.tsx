/**
 * Skia annotation layer with optional socket sync (trainer → trainee).
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Canvas,
  Path,
  Skia,
  type SkPath,
} from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import type { RemoteStroke, StrokePoint } from "../useDrawingSync";
import type { AnnotationTool } from "./MeetingAnnotationToolbar";

type Stroke = { path: SkPath; color: string; width: number };

type Props = {
  enabled: boolean;
  tool?: AnnotationTool;
  color?: string;
  strokeWidth?: number;
  remoteStrokes?: RemoteStroke[];
  onStrokeComplete?: (
    stroke: RemoteStroke,
    canvasSize: { width: number; height: number }
  ) => void;
};

function shapePath(tool: AnnotationTool, x0: number, y0: number, x1: number, y1: number): SkPath {
  const path = Skia.Path.Make();
  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const w = Math.abs(x1 - x0);
  const h = Math.abs(y1 - y0);
  if (tool === "line" || tool === "arrow") {
    path.moveTo(x0, y0);
    path.lineTo(x1, y1);
    if (tool === "arrow") {
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const head = 12;
      path.moveTo(x1, y1);
      path.lineTo(
        x1 - head * Math.cos(angle - Math.PI / 6),
        y1 - head * Math.sin(angle - Math.PI / 6)
      );
      path.moveTo(x1, y1);
      path.lineTo(
        x1 - head * Math.cos(angle + Math.PI / 6),
        y1 - head * Math.sin(angle + Math.PI / 6)
      );
    }
    return path;
  }
  if (tool === "rect") {
    path.addRect({ x: left, y: top, width: w, height: h });
    return path;
  }
  if (tool === "circle") {
    path.addOval({ x: left, y: top, width: w, height: h });
    return path;
  }
  return path;
}

function shapePoints(tool: AnnotationTool, x0: number, y0: number, x1: number, y1: number): StrokePoint[] {
  if (tool === "line" || tool === "arrow") {
    return [
      { x: x0, y: y0 },
      { x: x1, y: y1 },
    ];
  }
  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const right = Math.max(x0, x1);
  const bottom = Math.max(y0, y1);
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function pointsToPath(points: StrokePoint[]): SkPath {
  const path = Skia.Path.Make();
  if (points.length === 0) return path;
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i].x, points[i].y);
  }
  return path;
}

function freehandPathFromPoints(points: StrokePoint[]): SkPath {
  const path = Skia.Path.Make();
  if (points.length === 0) return path;
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i].x, points[i].y);
  }
  return path;
}

export function DrawingOverlay({
  enabled,
  tool = "freehand",
  color = "#ff3b30",
  strokeWidth = 4,
  remoteStrokes = [],
  onStrokeComplete,
}: Props) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [textLabels, setTextLabels] = useState<RemoteStroke[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const pointsRef = useRef<StrokePoint[]>([]);
  const startRef = useRef<StrokePoint | null>(null);
  const canvasSizeRef = useRef({ width: 1, height: 1 });
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });

  const [textModalOpen, setTextModalOpen] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [textAnchor, setTextAnchor] = useState<StrokePoint | null>(null);

  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const strokeWidthRef = useRef(strokeWidth);
  toolRef.current = tool;
  colorRef.current = color;
  strokeWidthRef.current = strokeWidth;

  const emitStroke = useCallback(
    (stroke: RemoteStroke) => {
      try {
        onStrokeComplete?.(stroke, canvasSizeRef.current);
      } catch {
        /* ignore */
      }
    },
    [onStrokeComplete]
  );

  const commitStroke = useCallback((stroke: Stroke) => {
    setStrokes((s) => [...s, stroke]);
    setCurrent(null);
  }, []);

  const finishShape = useCallback(
    (x0: number, y0: number, x1: number, y1: number) => {
      const t = toolRef.current;
      const path = shapePath(t, x0, y0, x1, y1);
      commitStroke({ path, color: colorRef.current, width: strokeWidthRef.current });
      emitStroke({
        points: shapePoints(t, x0, y0, x1, y1),
        color: colorRef.current,
        width: strokeWidthRef.current,
      });
    },
    [commitStroke, emitStroke]
  );

  const updateFreehand = useCallback((x: number, y: number) => {
    pointsRef.current.push({ x, y });
    const path = freehandPathFromPoints(pointsRef.current);
    setCurrent({ path, color: colorRef.current, width: strokeWidthRef.current });
  }, []);

  const finishFreehand = useCallback(() => {
    const pts = [...pointsRef.current];
    pointsRef.current = [];
    startRef.current = null;
    setCurrent(null);
    if (pts.length > 1) {
      const path = freehandPathFromPoints(pts);
      setStrokes((s) => [
        ...s,
        { path, color: colorRef.current, width: strokeWidthRef.current },
      ]);
      emitStroke({
        points: pts,
        color: colorRef.current,
        width: strokeWidthRef.current,
      });
    }
  }, [emitStroke]);

  const openTextModal = useCallback((x: number, y: number) => {
    setTextAnchor({ x, y });
    setTextDraft("");
    setTextModalOpen(true);
  }, []);

  const confirmText = useCallback(() => {
    const anchor = textAnchor;
    const value = textDraft.trim();
    setTextModalOpen(false);
    setTextAnchor(null);
    if (!anchor || !value) return;
    const stroke: RemoteStroke = {
      points: [anchor],
      color: colorRef.current,
      width: strokeWidthRef.current,
      kind: "text",
      text: value,
    };
    setTextLabels((s) => [...s, stroke]);
    emitStroke(stroke);
  }, [emitStroke, textAnchor, textDraft]);

  const onPanStart = useCallback(
    (x: number, y: number) => {
      if (toolRef.current === "text") {
        openTextModal(x, y);
        return;
      }
      startRef.current = { x, y };
      if (toolRef.current !== "freehand") {
        const path = shapePath(toolRef.current, x, y, x, y);
        setCurrent({ path, color: colorRef.current, width: strokeWidthRef.current });
        return;
      }
      pointsRef.current = [{ x, y }];
      setCurrent({
        path: freehandPathFromPoints(pointsRef.current),
        color: colorRef.current,
        width: strokeWidthRef.current,
      });
    },
    [openTextModal]
  );

  const onPanUpdate = useCallback((x: number, y: number) => {
    if (toolRef.current === "text") return;
    const start = startRef.current;
    if (!start) return;
    if (toolRef.current !== "freehand") {
      const path = shapePath(toolRef.current, start.x, start.y, x, y);
      setCurrent({ path, color: colorRef.current, width: strokeWidthRef.current });
      return;
    }
    updateFreehand(x, y);
  }, [updateFreehand]);

  const onPanEnd = useCallback(
    (x: number, y: number) => {
      if (toolRef.current === "text") return;
      const start = startRef.current;
      if (!start) return;
      if (toolRef.current !== "freehand") {
        finishShape(start.x, start.y, x, y);
        return;
      }
      updateFreehand(x, y);
      finishFreehand();
    },
    [finishFreehand, finishShape, updateFreehand]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .minDistance(0)
        .onStart((e) => {
          runOnJS(onPanStart)(e.x, e.y);
        })
        .onUpdate((e) => {
          runOnJS(onPanUpdate)(e.x, e.y);
        })
        .onEnd((e) => {
          runOnJS(onPanEnd)(e.x, e.y);
        }),
    [enabled, onPanEnd, onPanStart, onPanUpdate]
  );

  const allText = useMemo(
    () => [
      ...remoteStrokes.filter((r) => r.kind === "text" && r.text),
      ...textLabels,
    ],
    [remoteStrokes, textLabels]
  );

  if (
    !enabled &&
    strokes.length === 0 &&
    !current &&
    remoteStrokes.length === 0 &&
    textLabels.length === 0
  ) {
    return null;
  }

  return (
    <>
      <GestureDetector gesture={pan}>
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={enabled ? "auto" : "box-none"}
          onLayout={(e: LayoutChangeEvent) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0) {
              const size = { width, height };
              canvasSizeRef.current = size;
              setCanvasSize(size);
            }
          }}
        >
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            {remoteStrokes
              .filter((r) => r.kind !== "text")
              .map((rs, i) => (
                <Path
                  key={`remote-${i}`}
                  path={pointsToPath(rs.points)}
                  style="stroke"
                  strokeWidth={rs.width}
                  color={rs.color}
                />
              ))}
            {strokes.map((s, i) => (
              <Path
                key={`local-${i}`}
                path={s.path}
                style="stroke"
                strokeWidth={s.width}
                color={s.color}
              />
            ))}
            {current ? (
              <Path
                path={current.path}
                style="stroke"
                strokeWidth={current.width}
                color={current.color}
              />
            ) : null}
          </Canvas>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {allText.map((t, i) => {
              const p = t.points[0];
              if (!p || !t.text) return null;
              return (
                <Text
                  key={`text-${i}-${t.text}`}
                  style={[
                    styles.textLabel,
                    { color: t.color, left: p.x, top: p.y },
                  ]}
                >
                  {t.text}
                </Text>
              );
            })}
          </View>
        </View>
      </GestureDetector>

      <Modal visible={textModalOpen} transparent animationType="fade">
        <View style={styles.textModalBackdrop}>
          <View style={styles.textModalCard}>
            <Text style={styles.textModalTitle}>Add label</Text>
            <TextInput
              style={styles.textInput}
              value={textDraft}
              onChangeText={setTextDraft}
              placeholder="Type annotation text"
              placeholderTextColor="#888"
              autoFocus
            />
            <View style={styles.textModalActions}>
              <Pressable
                style={styles.textModalBtnSecondary}
                onPress={() => {
                  setTextModalOpen(false);
                  setTextAnchor(null);
                }}
              >
                <Text style={styles.textModalBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.textModalBtnPrimary} onPress={confirmText}>
                <Text style={styles.textModalBtnPrimaryText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  textModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 24,
  },
  textModalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  textModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0b1f3a",
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111",
  },
  textLabel: {
    position: "absolute",
    fontSize: 18,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  textModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  textModalBtnSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  textModalBtnSecondaryText: { color: "#555", fontWeight: "600" },
  textModalBtnPrimary: {
    backgroundColor: "#0b1f3a",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textModalBtnPrimaryText: { color: "#fff", fontWeight: "600" },
});
