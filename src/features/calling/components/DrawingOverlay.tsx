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
  matchFont,
  Path,
  Skia,
  Text as SkiaText,
  type SkPath,
} from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import type {
  AnnotationFitMode,
  ClipAnnotationLayout,
  ContentAspect,
  ContentRect,
} from "../annotationCoords";
import { resolveClipContentInsets } from "../annotationCoords";
import { projectStrokeToCanvas, strokeForSyncEmit } from "../annotationRenderUtils";
import type { PanPoint } from "../clipZoomPanUtils";
import type { AnnotationShapeKind, RemoteStroke, StrokePoint } from "../useDrawingSync";
import type { AnnotationTool } from "./MeetingAnnotationToolbar";

type Stroke = { path: SkPath; color: string; width: number };

type Props = {
  enabled: boolean;
  /** Keep the layer mounted so remote strokes can render (trainee view). */
  showRemoteLayer?: boolean;
  tool?: AnnotationTool;
  color?: string;
  strokeWidth?: number;
  remoteStrokes?: RemoteStroke[];
  /** Clip or live video intrinsic size — enables cross-device content UV sync. */
  contentAspect?: ContentAspect | null;
  contentFit?: AnnotationFitMode;
  /** Restrict UV mapping to the visible clip video sub-rect (excludes controls dock). */
  clipAnnotationLayout?: ClipAnnotationLayout | null;
  /** Measured video patch in overlay coordinates (preferred over analytic insets). */
  measuredContentRect?: ContentRect | null;
  /** Active clip zoom/pan for UV emit and render. */
  zoomPan?: { zoom: number; pan: PanPoint } | null;
  annotationTargetUserId?: string | null;
  /** Per-stroke projection (dual-pane / live vs clip). */
  resolveStrokeProjection?: (stroke: RemoteStroke) => import("../annotationRenderUtils").AnnotationProjectionOptions;
  /** Dual-clip pane hit targets in overlay coordinates. */
  paneHitRects?: Array<{ paneIndex: 0 | 1; rect: ContentRect }>;
  activeAnnotationPane?: 0 | 1 | null;
  onAnnotationPaneSelect?: (pane: 0 | 1) => void;
  annotationStage?: "clip" | "live";
  annotationPaneIndex?: 0 | 1;
  onStrokeComplete?: (
    stroke: RemoteStroke,
    canvasSize: { width: number; height: number }
  ) => void;
  /** Trainer: committed strokes render from remoteStrokes (socket buffer), not local state. */
  commitToRemoteLayer?: boolean;
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

function remoteStrokePath(stroke: RemoteStroke): SkPath {
  const kind = stroke.kind ?? "stroke";
  const bounds = stroke.shapeBounds;
  if (bounds) {
    const x0 = bounds.x0;
    const y0 = bounds.y0;
    const x1 = bounds.x1;
    const y1 = bounds.y1;
    const path = Skia.Path.Make();
    if (kind === "rect") {
      path.addRect({
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0),
      });
      return path;
    }
    if (kind === "circle") {
      path.addOval({
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0),
      });
      return path;
    }
    if (kind === "line" || kind === "arrow") {
      path.moveTo(x0, y0);
      path.lineTo(x1, y1);
      if (kind === "arrow") {
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
  }
  const path = pointsToPath(stroke.points);
  if (kind === "rect" || kind === "circle") {
    path.close();
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
  showRemoteLayer = false,
  tool = "freehand",
  color = "#ff3b30",
  strokeWidth = 4,
  remoteStrokes = [],
  contentAspect = null,
  contentFit = "contain",
  clipAnnotationLayout = null,
  measuredContentRect = null,
  zoomPan = null,
  annotationTargetUserId = null,
  resolveStrokeProjection,
  paneHitRects,
  activeAnnotationPane = null,
  onAnnotationPaneSelect,
  annotationStage = "clip",
  annotationPaneIndex = 0,
  onStrokeComplete,
  commitToRemoteLayer = false,
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

  const contentAspectRef = useRef(contentAspect);
  contentAspectRef.current = contentAspect;
  const clipAnnotationLayoutRef = useRef(clipAnnotationLayout);
  clipAnnotationLayoutRef.current = clipAnnotationLayout;
  const measuredContentRectRef = useRef(measuredContentRect);
  measuredContentRectRef.current = measuredContentRect;
  const zoomPanRef = useRef(zoomPan);
  zoomPanRef.current = zoomPan;
  const resolveStrokeProjectionRef = useRef(resolveStrokeProjection);
  resolveStrokeProjectionRef.current = resolveStrokeProjection;
  const paneHitRectsRef = useRef(paneHitRects);
  paneHitRectsRef.current = paneHitRects;
  const activeAnnotationPaneRef = useRef(activeAnnotationPane);
  activeAnnotationPaneRef.current = activeAnnotationPane;
  const onAnnotationPaneSelectRef = useRef(onAnnotationPaneSelect);
  onAnnotationPaneSelectRef.current = onAnnotationPaneSelect;
  const annotationStageRef = useRef(annotationStage);
  annotationStageRef.current = annotationStage;
  const annotationPaneIndexRef = useRef(annotationPaneIndex);
  annotationPaneIndexRef.current = annotationPaneIndex;
  const contentInsetsRef = useRef({ top: 0, bottom: 0, left: 0, right: 0 });

  const projectionOptions = useCallback(() => {
    const canvasSize = canvasSizeRef.current;
    const contentInsets =
      measuredContentRectRef.current == null && clipAnnotationLayoutRef.current
        ? resolveClipContentInsets(canvasSize, clipAnnotationLayoutRef.current)
        : undefined;
    contentInsetsRef.current = contentInsets ?? { top: 0, bottom: 0, left: 0, right: 0 };
    return {
      contentAspect: contentAspectRef.current,
      contentFit,
      contentInsets,
      measuredContentRect: measuredContentRectRef.current,
      zoomPan: zoomPanRef.current,
      targetUserId: annotationTargetUserId,
    };
  }, [annotationTargetUserId, contentFit]);

  const projectionOptionsForStroke = useCallback(
    (stroke: RemoteStroke) =>
      resolveStrokeProjectionRef.current?.(stroke) ?? projectionOptions(),
    [projectionOptions]
  );

  const strokeMeta = useCallback(
    (): Pick<RemoteStroke, "paneIndex" | "stage"> => ({
      paneIndex: annotationStageRef.current === "clip" ? annotationPaneIndexRef.current : undefined,
      stage: annotationStageRef.current,
    }),
    []
  );

  const emitStroke = useCallback(
    (stroke: RemoteStroke) => {
      try {
        const canvasSize = canvasSizeRef.current;
        const synced = strokeForSyncEmit(
          { ...strokeMeta(), ...stroke },
          canvasSize,
          projectionOptionsForStroke(stroke)
        );
        onStrokeComplete?.(synced, canvasSize);
      } catch {
        /* ignore */
      }
    },
    [onStrokeComplete, projectionOptionsForStroke, strokeMeta]
  );

  const projectForDisplay = useCallback(
    (stroke: RemoteStroke) => {
      const opts = projectionOptionsForStroke(stroke);
      return projectStrokeToCanvas(
        stroke,
        canvasSize,
        stroke.contentAspect ?? opts.contentAspect ?? contentAspect,
        stroke.contentFit ?? opts.contentFit ?? contentFit,
        opts.contentInsets,
        {
          measuredContentRect: opts.measuredContentRect,
          zoomPan: opts.zoomPan,
        }
      );
    },
    [canvasSize, contentAspect, contentFit, projectionOptionsForStroke]
  );

  const commitToRemoteLayerRef = useRef(commitToRemoteLayer);
  commitToRemoteLayerRef.current = commitToRemoteLayer;

  const commitStroke = useCallback((stroke: Stroke) => {
    if (commitToRemoteLayerRef.current) return;
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
        kind: t as AnnotationShapeKind,
        shapeBounds: { x0, y0, x1, y1 },
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
      if (!commitToRemoteLayerRef.current) {
        setStrokes((s) => [
          ...s,
          { path, color: colorRef.current, width: strokeWidthRef.current },
        ]);
      }
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
    if (!commitToRemoteLayerRef.current) {
      setTextLabels((s) => [...s, stroke]);
    }
    emitStroke(stroke);
  }, [emitStroke, textAnchor, textDraft]);

  const hitTestPane = useCallback((x: number, y: number): boolean => {
    const rects = paneHitRectsRef.current;
    if (!rects?.length) return true;
    let hitPane: 0 | 1 | null = null;
    for (const { paneIndex, rect } of rects) {
      if (
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height
      ) {
        hitPane = paneIndex;
        break;
      }
    }
    if (hitPane == null) return false;
    const active = activeAnnotationPaneRef.current;
    if (active != null && hitPane !== active) return false;
    onAnnotationPaneSelectRef.current?.(hitPane);
    return true;
  }, []);

  const onPanStart = useCallback(
    (x: number, y: number) => {
      if (!hitTestPane(x, y)) return;
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
    [hitTestPane, openTextModal]
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
    () =>
      [
        ...remoteStrokes.filter((r) => {
          if (r.kind !== "text" || !r.text) return false;
          const stage = r.stage ?? "clip";
          return stage === annotationStage;
        }),
        ...(commitToRemoteLayer ? [] : textLabels),
      ].map((t) => projectForDisplay(t)),
    [remoteStrokes, textLabels, projectForDisplay, annotationStage, commitToRemoteLayer]
  );

  const scaledRemoteStrokes = useMemo(
    () =>
      remoteStrokes
        .filter((r) => {
          if (r.kind === "text") return false;
          const stage = r.stage ?? "clip";
          return stage === annotationStage;
        })
        .map((r) => projectForDisplay(r)),
    [remoteStrokes, projectForDisplay, annotationStage]
  );

  if (
    !enabled &&
    !showRemoteLayer &&
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
              if (clipAnnotationLayoutRef.current) {
                contentInsetsRef.current = resolveClipContentInsets(
                  size,
                  clipAnnotationLayoutRef.current
                );
              }
            }
          }}
        >
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            {scaledRemoteStrokes.map((rs, i) => (
              <Path
                key={`remote-${i}`}
                path={remoteStrokePath(rs)}
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
            {allText.map((t, i) => {
              const p = t.points[0];
              if (!p || !t.text) return null;
              /**
               * Skia v1 reworked `<Text>`: instead of a top-level
               * `fontSize` prop, it now requires a `font: SkFont`. We
               * cheaply build one per-label via `matchFont` — these
               * annotations are static (no per-frame animation) so the
               * extra allocation is negligible.
               */
              const labelFont = matchFont({ fontSize: 18 });
              return (
                <SkiaText
                  key={`text-${i}-${t.text}`}
                  x={p.x}
                  y={p.y}
                  text={t.text}
                  color={Skia.Color(t.color)}
                  font={labelFont}
                />
              );
            })}
          </Canvas>
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
