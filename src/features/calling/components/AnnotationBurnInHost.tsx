/**
 * Off-screen compositor: base frame + scaled annotations → view-shot JPEG.
 * Reliable on iOS where Skia inside the live capture wrapper often misses GPU layers.
 */

import React, {
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { Image, View } from "react-native";
import { captureRef as captureViewToImage } from "react-native-view-shot";

import type { AnnotationProjectionOptions } from "../annotationRenderUtils";
import type { RemoteStroke } from "../useDrawingSync";
import { StaticAnnotationCanvas } from "./StaticAnnotationCanvas";

const EXPORT_WIDTH = 1080;
const EXPORT_JPEG_QUALITY = 0.96;

export type AnnotationBurnInHostHandle = {
  composite: (
    baseUri: string,
    strokes: RemoteStroke[],
    canvasSize: { width: number; height: number },
    projection?: AnnotationProjectionOptions
  ) => Promise<string | null>;
};

type BurnState = {
  baseUri: string;
  strokes: RemoteStroke[];
  canvasSize: { width: number; height: number };
  projection?: AnnotationProjectionOptions;
  height: number;
};

type Props = {
  ref?: Ref<AnnotationBurnInHostHandle>;
};

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** React 19: ref is a normal prop — avoids forwardRef arity warnings. */
export function AnnotationBurnInHost({ ref }: Props) {
  const captureRefView = useRef<View>(null);
  const [job, setJob] = useState<BurnState | null>(null);
  const resolverRef = useRef<((uri: string | null) => void) | null>(null);
  const imageReadyRef = useRef(false);

  const finish = useCallback(async () => {
    if (!captureRefView.current || !job) {
      resolverRef.current?.(null);
      resolverRef.current = null;
      setJob(null);
      return;
    }
    await delay(48);
    try {
      const uri = await captureViewToImage(captureRefView, {
        format: "jpg",
        quality: EXPORT_JPEG_QUALITY,
        result: "tmpfile",
      });
      resolverRef.current?.(uri);
    } catch {
      resolverRef.current?.(null);
    } finally {
      resolverRef.current = null;
      setJob(null);
      imageReadyRef.current = false;
    }
  }, [job]);

  const tryFinish = useCallback(() => {
    if (!job || !imageReadyRef.current) return;
    void finish();
  }, [finish, job]);

  useImperativeHandle(
    ref,
    () => ({
      composite: (baseUri, strokes, canvasSize, projection) =>
        new Promise<string | null>((resolve) => {
          if (!strokes.length || canvasSize.width < 2 || canvasSize.height < 2) {
            resolve(null);
            return;
          }
          resolverRef.current = resolve;
          imageReadyRef.current = false;
          const aspect = canvasSize.height / canvasSize.width;
          const height = Math.max(1, Math.round(EXPORT_WIDTH * aspect));
          setJob({ baseUri, strokes, canvasSize, projection, height });
        }),
    }),
    []
  );

  if (!job) return null;

  return (
    <View
      ref={captureRefView}
      collapsable={false}
      style={{
        position: "absolute",
        left: -5000,
        top: 0,
        width: EXPORT_WIDTH,
        height: job.height,
        backgroundColor: "#ffffff",
      }}
    >
      <Image
        source={{ uri: job.baseUri }}
        style={{ width: EXPORT_WIDTH, height: job.height, backgroundColor: "#fff" }}
        resizeMode="cover"
        onLoadEnd={() => {
          imageReadyRef.current = true;
          tryFinish();
        }}
        onError={() => {
          resolverRef.current?.(null);
          resolverRef.current = null;
          setJob(null);
        }}
      />
      <StaticAnnotationCanvas
        strokes={job.strokes}
        sourceCanvasSize={job.canvasSize}
        width={EXPORT_WIDTH}
        height={job.height}
        projection={job.projection}
      />
    </View>
  );
}
