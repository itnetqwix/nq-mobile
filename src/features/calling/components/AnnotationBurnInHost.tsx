/**
 * Off-screen compositor: base frame + scaled annotations → view-shot JPEG.
 * Reliable on iOS where Skia inside the live capture wrapper often misses GPU layers.
 */

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Image, View } from "react-native";
import { captureRef as captureViewToImage } from "react-native-view-shot";

import type { RemoteStroke } from "../useDrawingSync";
import { StaticAnnotationCanvas } from "./StaticAnnotationCanvas";

const EXPORT_WIDTH = 720;

export type AnnotationBurnInHostHandle = {
  composite: (
    baseUri: string,
    strokes: RemoteStroke[],
    canvasSize: { width: number; height: number }
  ) => Promise<string | null>;
};

type BurnState = {
  baseUri: string;
  strokes: RemoteStroke[];
  canvasSize: { width: number; height: number };
  height: number;
};

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export const AnnotationBurnInHost = forwardRef<AnnotationBurnInHostHandle>(
  function AnnotationBurnInHost(_props, ref) {
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
          quality: 0.9,
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
        composite: (baseUri, strokes, canvasSize) =>
          new Promise<string | null>((resolve) => {
            if (!strokes.length || canvasSize.width < 2 || canvasSize.height < 2) {
              resolve(null);
              return;
            }
            resolverRef.current = resolve;
            imageReadyRef.current = false;
            const aspect = canvasSize.height / canvasSize.width;
            const height = Math.max(1, Math.round(EXPORT_WIDTH * aspect));
            setJob({ baseUri, strokes, canvasSize, height });
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
          resizeMode="contain"
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
        />
      </View>
    );
  }
);
