/**
 * Crop UI with move + corner resize (web react-image-crop parity).
 */

import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

type CropRect = { x: number; y: number; width: number; height: number };

type HandleId = "move" | "tl" | "tr" | "bl" | "br";

const MIN_CROP = 56;
const HANDLE = 28;

type Props = {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  onCropped: (uri: string) => void;
};

function clampRect(
  rect: CropRect,
  maxW: number,
  maxH: number
): CropRect {
  let { x, y, width, height } = rect;
  width = Math.max(MIN_CROP, Math.min(width, maxW));
  height = Math.max(MIN_CROP, Math.min(height, maxH));
  x = Math.max(0, Math.min(x, maxW - width));
  y = Math.max(0, Math.min(y, maxH - height));
  return { x, y, width, height };
}

function resizeFromHandle(
  start: CropRect,
  handle: HandleId,
  dx: number,
  dy: number,
  maxW: number,
  maxH: number
): CropRect {
  let { x, y, width, height } = start;
  if (handle === "move") {
    return clampRect({ x: x + dx, y: y + dy, width, height }, maxW, maxH);
  }
  if (handle === "tl") {
    x += dx;
    y += dy;
    width -= dx;
    height -= dy;
  } else if (handle === "tr") {
    y += dy;
    width += dx;
    height -= dy;
  } else if (handle === "bl") {
    x += dx;
    width -= dx;
    height += dy;
  } else if (handle === "br") {
    width += dx;
    height += dy;
  }
  return clampRect({ x, y, width, height }, maxW, maxH);
}

export function ReportImageCropModal({ visible, imageUri, onClose, onCropped }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [natural, setNatural] = useState({ width: 1, height: 1 });
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [busy, setBusy] = useState(false);

  const displayWidth = Math.min(windowWidth - 32, 360);
  const displayHeight =
    natural.width > 0 ? (displayWidth * natural.height) / natural.width : displayWidth * 0.75;

  const cropRef = useRef(crop);
  cropRef.current = crop;
  const dragRef = useRef<{
    handle: HandleId;
    startRect: CropRect;
  } | null>(null);

  useEffect(() => {
    if (!visible || !imageUri) return;
    Image.getSize(
      imageUri,
      (w, h) => {
        setNatural({ width: w, height: h });
        const dw = displayWidth;
        const dh = (dw * h) / w;
        const margin = 0.06;
        setCrop({
          x: dw * margin,
          y: dh * margin,
          width: dw * (1 - margin * 2),
          height: dh * (1 - margin * 2),
        });
      },
      () => setNatural({ width: 1, height: 1 })
    );
  }, [visible, imageUri, displayWidth]);

  const makeHandleResponder = useCallback(
    (handle: HandleId) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          if (!cropRef.current) return;
          dragRef.current = { handle, startRect: { ...cropRef.current } };
        },
        onPanResponderMove: (_, g) => {
          const drag = dragRef.current;
          if (!drag) return;
          setCrop(
            resizeFromHandle(
              drag.startRect,
              drag.handle,
              g.dx,
              g.dy,
              displayWidth,
              displayHeight
            )
          );
        },
        onPanResponderRelease: () => {
          dragRef.current = null;
        },
        onPanResponderTerminate: () => {
          dragRef.current = null;
        },
      }),
    [displayHeight, displayWidth]
  );

  const moveResponder = useMemo(() => makeHandleResponder("move"), [makeHandleResponder]);
  const tlResponder = useMemo(() => makeHandleResponder("tl"), [makeHandleResponder]);
  const trResponder = useMemo(() => makeHandleResponder("tr"), [makeHandleResponder]);
  const blResponder = useMemo(() => makeHandleResponder("bl"), [makeHandleResponder]);
  const brResponder = useMemo(() => makeHandleResponder("br"), [makeHandleResponder]);

  const applyCrop = useCallback(async () => {
    if (!crop || !imageUri || natural.width < 2) return;
    setBusy(true);
    try {
      const scaleX = natural.width / displayWidth;
      const scaleY = natural.height / displayHeight;
      const originX = Math.round(crop.x * scaleX);
      const originY = Math.round(crop.y * scaleY);
      const width = Math.max(1, Math.round(crop.width * scaleX));
      const height = Math.max(1, Math.round(crop.height * scaleY));
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG }
      );
      onCropped(result.uri);
      onClose();
    } finally {
      setBusy(false);
    }
  }, [crop, displayHeight, displayWidth, imageUri, natural.height, natural.width, onClose, onCropped]);

  if (!visible) return null;

  const dimTop = crop ? crop.y : 0;
  const dimLeft = crop ? crop.x : 0;
  const dimRight = crop ? displayWidth - crop.x - crop.width : 0;
  const dimBottom = crop ? displayHeight - crop.y - crop.height : 0;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Crop frame</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#333" />
          </Pressable>
        </View>
        <Text style={styles.hint}>
          Drag inside the box to move it. Drag a corner to resize.
        </Text>
        <View style={[styles.stage, { width: displayWidth, height: displayHeight }]}>
          <Image
            source={{ uri: imageUri }}
            style={{ width: displayWidth, height: displayHeight }}
            resizeMode="contain"
          />
          {crop ? (
            <>
              <View style={[styles.dim, { top: 0, left: 0, right: 0, height: dimTop }]} />
              <View
                style={[
                  styles.dim,
                  { top: dimTop, left: 0, width: dimLeft, height: crop.height },
                ]}
              />
              <View
                style={[
                  styles.dim,
                  {
                    top: dimTop,
                    right: 0,
                    width: dimRight,
                    height: crop.height,
                  },
                ]}
              />
              <View
                style={[styles.dim, { bottom: 0, left: 0, right: 0, height: dimBottom }]}
              />
              <View
                style={[
                  styles.cropBox,
                  {
                    left: crop.x,
                    top: crop.y,
                    width: crop.width,
                    height: crop.height,
                  },
                ]}
                {...moveResponder.panHandlers}
              >
                <View
                  style={[styles.handle, styles.handleTl]}
                  {...tlResponder.panHandlers}
                />
                <View
                  style={[styles.handle, styles.handleTr]}
                  {...trResponder.panHandlers}
                />
                <View
                  style={[styles.handle, styles.handleBl]}
                  {...blResponder.panHandlers}
                />
                <View
                  style={[styles.handle, styles.handleBr]}
                  {...brResponder.panHandlers}
                />
              </View>
            </>
          ) : null}
        </View>
        <Pressable
          style={[styles.applyBtn, busy && styles.applyDisabled]}
          onPress={() => void applyCrop()}
          disabled={busy || !crop}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.applyText}>Apply crop</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f4f6f9", padding: 16, paddingTop: 48 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "800", color: "#14328d" },
  hint: { marginTop: 8, fontSize: 13, color: "#666", lineHeight: 18 },
  stage: {
    alignSelf: "center",
    marginTop: 16,
    backgroundColor: "#111",
    overflow: "hidden",
    borderRadius: 8,
  },
  dim: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  cropBox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#fff",
  },
  handle: {
    position: "absolute",
    width: HANDLE,
    height: HANDLE,
    borderWidth: 3,
    borderColor: "#ff3b30",
    backgroundColor: "#fff",
    borderRadius: 4,
  },
  handleTl: { left: -HANDLE / 2, top: -HANDLE / 2 },
  handleTr: { right: -HANDLE / 2, top: -HANDLE / 2 },
  handleBl: { left: -HANDLE / 2, bottom: -HANDLE / 2 },
  handleBr: { right: -HANDLE / 2, bottom: -HANDLE / 2 },
  applyBtn: {
    marginTop: 20,
    backgroundColor: "#14328d",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  applyDisabled: { opacity: 0.6 },
  applyText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
