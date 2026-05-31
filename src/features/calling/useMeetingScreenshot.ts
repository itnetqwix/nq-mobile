import { useCallback, useRef, useState, type RefObject } from "react";
import { Alert, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";
import { putFileToPresignedUrl } from "../../lib/presignedPut";

import {
  captureClipFrameUri,
  captureClipFrames,
} from "./captureClipScreenshot";
import { normalizeReportImageKeys } from "./reportDataUtils";
import { fetchSessionReport, requestScreenshotUpload } from "./meetingReportApi";

export type ScreenshotCaptureSource = {
  uri: string;
  progressSeconds: number;
};

export type ScreenshotCapturedPayload = {
  localUri: string;
  imageKey: string;
};

export type CaptureStage = "idle" | "preparing" | "uploading";

type Args = {
  sessionId: string;
  trainerId: string;
  traineeId: string;
  isTrainer: boolean;
  onCaptured?: (payload: ScreenshotCapturedPayload) => void;
};

const CAPTURE_FRAME_DELAY_MS = 200;
const COMPOSITE_LAYOUT_DELAY_MS = 450;
const MIN_CAPTURE_BYTES = 12_000;

function extractImageKeyFromPresignResponse(
  presign: { data?: { url?: string; filename?: string } },
  uploadUrl: string
): string {
  if (presign?.data?.filename) return String(presign.data.filename);
  const path = uploadUrl.split("?")[0];
  const parts = path.split("/");
  return parts[parts.length - 1] || `file-${Date.now()}.png`;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function useMeetingScreenshot({
  sessionId,
  trainerId,
  traineeId,
  isTrainer,
  onCaptured,
}: Args) {
  const captureTargetRef = useRef<View>(null);
  const compositeHostRef = useRef<View>(null);
  const pendingPreviewUriRef = useRef<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureStage, setCaptureStage] = useState<CaptureStage>("idle");
  const [captureCount, setCaptureCount] = useState(0);
  const [screenshotKeys, setScreenshotKeys] = useState<string[]>([]);
  const [compositeFrameUris, setCompositeFrameUris] = useState<string[]>([]);

  const disposePendingPreview = useCallback(async () => {
    const uri = pendingPreviewUriRef.current;
    pendingPreviewUriRef.current = null;
    if (!uri) return;
    try {
      const normalized = uri.split("?")[0];
      const info = await FileSystem.getInfoAsync(normalized);
      if (info.exists) {
        await FileSystem.deleteAsync(normalized, { idempotent: true });
      }
    } catch {
      /** best-effort */
    }
  }, []);

  const refreshScreenshots = useCallback(async () => {
    try {
      const res = await fetchSessionReport({
        sessions: sessionId,
        trainer: trainerId,
        trainee: traineeId,
      });
      const data = res?.data ?? res;
      setScreenshotKeys(normalizeReportImageKeys(data?.reportData));
    } catch {
      /** keep local list */
    }
  }, [sessionId, traineeId, trainerId]);

  const uploadPng = useCallback(
    async (localUri: string) => {
      const presign = await requestScreenshotUpload({
        sessions: sessionId,
        trainer: trainerId,
        trainee: traineeId,
      });
      const uploadUrl = presign?.data?.url;
      if (!uploadUrl) {
        throw new Error("No upload URL returned");
      }
      await putFileToPresignedUrl(uploadUrl, localUri, "image/png");
      return extractImageKeyFromPresignResponse(presign, uploadUrl);
    },
    [sessionId, traineeId, trainerId]
  );

  const captureViewShot = useCallback(async (ref: RefObject<View | null>) => {
    if (!ref.current) return null;
    try {
      const uri = await captureRef(ref, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      const normalized = uri.split("?")[0];
      const info = await FileSystem.getInfoAsync(normalized);
      if (info.exists && "size" in info && typeof info.size === "number") {
        if (info.size >= MIN_CAPTURE_BYTES) return uri;
      }
      return null;
    } catch (e) {
      if (__DEV__) console.warn("[meeting] view-shot capture failed", e);
      return null;
    }
  }, []);

  const framesReadyPromiseRef = useRef<{
    resolve: () => void;
    promise: Promise<void>;
  } | null>(null);

  const onCompositeFramesReady = useCallback(() => {
    framesReadyPromiseRef.current?.resolve();
  }, []);

  const captureCompositeFromFrames = useCallback(
    async (frameUris: string[]): Promise<string | null> => {
      if (frameUris.length < 2) return frameUris[0] ?? null;
      let resolveReady!: () => void;
      const readyPromise = new Promise<void>((resolve) => {
        resolveReady = resolve;
      });
      framesReadyPromiseRef.current = { resolve: resolveReady, promise: readyPromise };
      setCompositeFrameUris(frameUris.slice(0, 2));
      await Promise.race([
        readyPromise,
        delay(COMPOSITE_LAYOUT_DELAY_MS).then(() => undefined),
      ]);
      await delay(80);
      const uri = await captureViewShot(compositeHostRef);
      setCompositeFrameUris([]);
      framesReadyPromiseRef.current = null;
      return uri;
    },
    [captureViewShot]
  );

  const captureFromFallbackSources = useCallback(
    async (fallbackSources?: ScreenshotCaptureSource[]) => {
      if (!fallbackSources?.length) return null;
      const valid = fallbackSources.filter((s) => !!s.uri);

      const frames = await captureClipFrames(valid);
      if (frames.length >= 2) {
        return captureCompositeFromFrames(frames);
      }
      if (frames.length === 1) return frames[0];

      for (const src of valid) {
        const frame = await captureClipFrameUri(src.uri, src.progressSeconds);
        if (frame) return frame;
      }
      return null;
    },
    [captureCompositeFromFrames]
  );

  const takeScreenshot = useCallback(
    async (fallbackSources?: ScreenshotCaptureSource[]) => {
      if (!isTrainer) return;
      setCapturing(true);
      setCaptureStage("preparing");
      try {
        await delay(CAPTURE_FRAME_DELAY_MS);

        let localUri: string | null = null;

        if (fallbackSources && fallbackSources.length > 0) {
          localUri = await captureFromFallbackSources(fallbackSources);
        }

        if (!localUri) {
          localUri = await captureViewShot(captureTargetRef);
        }

        if (!localUri) {
          throw new Error(
            "Could not capture this frame. Wait until the clip or video finishes loading, then try again."
          );
        }

        pendingPreviewUriRef.current = localUri;
        setCaptureStage("uploading");

        const imageKey = await uploadPng(localUri);
        setCaptureCount((n) => n + 1);
        setScreenshotKeys((prev) => [...new Set([...prev, imageKey])]);
        onCaptured?.({ localUri, imageKey });
      } catch (e: unknown) {
        await disposePendingPreview();
        setCompositeFrameUris([]);
        const msg = e instanceof Error ? e.message : "Could not save screenshot.";
        if (__DEV__) console.warn("[meeting] screenshot failed", e);
        Alert.alert("Screenshot failed", msg);
      } finally {
        setCapturing(false);
        setCaptureStage("idle");
      }
    },
    [
      captureFromFallbackSources,
      captureViewShot,
      disposePendingPreview,
      isTrainer,
      onCaptured,
      uploadPng,
    ]
  );

  return {
    captureTargetRef,
    compositeHostRef,
    compositeFrameUris,
    onCompositeFramesReady,
    takeScreenshot,
    capturing,
    captureStage,
    captureCount,
    screenshotKeys,
    refreshScreenshots,
    disposePendingPreview,
    hasCaptures: captureCount > 0 || screenshotKeys.length > 0,
  };
};
