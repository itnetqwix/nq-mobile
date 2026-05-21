import { useCallback, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";
import { putFileToPresignedUrl } from "../../lib/presignedPut";

import {
  captureClipFrameUri,
  captureClipFrames,
} from "./captureClipScreenshot";
import { fetchSessionReport, requestScreenshotUpload } from "./meetingReportApi";

export type ScreenshotCaptureSource = {
  uri: string;
  progressSeconds: number;
};

export type ScreenshotCapturedPayload = {
  localUri: string;
  imageKey: string;
};

type Args = {
  sessionId: string;
  trainerId: string;
  traineeId: string;
  isTrainer: boolean;
  onCaptured?: (payload: ScreenshotCapturedPayload) => void;
};

const CAPTURE_FRAME_DELAY_MS = 320;
const MIN_CAPTURE_BYTES = 8000;

function normalizeReportKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) =>
      typeof x === "string"
        ? x
        : (x as { name?: string; key?: string })?.name ??
          (x as { key?: string })?.key ??
          (x as { imageUrl?: string })?.imageUrl ??
          ""
    )
    .filter(Boolean);
}

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
  const pendingPreviewUriRef = useRef<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [screenshotKeys, setScreenshotKeys] = useState<string[]>([]);

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
      setScreenshotKeys(normalizeReportKeys(data?.reportData));
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

  const resolveImageKeyAfterUpload = useCallback(
    async (uploadedKey: string) => {
      let imageKey = uploadedKey;
      try {
        const res = await fetchSessionReport({
          sessions: sessionId,
          trainer: trainerId,
          trainee: traineeId,
        });
        const data = res?.data ?? res;
        const items = Array.isArray(data?.reportData) ? data.reportData : [];
        const last = items[items.length - 1] as { imageUrl?: string } | undefined;
        if (last?.imageUrl) imageKey = last.imageUrl;
      } catch {
        /** keep uploadedKey */
      }
      return imageKey;
    },
    [sessionId, trainerId, traineeId]
  );

  const captureViewShot = useCallback(async (): Promise<string | null> => {
    if (!captureTargetRef.current) return null;
    try {
      const uri = await captureRef(captureTargetRef, {
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

  const captureFromFallbackSources = useCallback(
    async (fallbackSources?: ScreenshotCaptureSource[]) => {
      if (!fallbackSources?.length) return null;
      const frames = await captureClipFrames(
        fallbackSources.filter((s) => !!s.uri)
      );
      if (frames.length > 0) return frames[0];
      for (const src of fallbackSources) {
        if (!src.uri) continue;
        const frame = await captureClipFrameUri(src.uri, src.progressSeconds);
        if (frame) return frame;
      }
      return null;
    },
    []
  );

  const takeScreenshot = useCallback(
    async (fallbackSources?: ScreenshotCaptureSource[]) => {
      if (!isTrainer) return;
      setCapturing(true);
      try {
        await delay(CAPTURE_FRAME_DELAY_MS);
        let localUri = await captureViewShot();

        if (!localUri) {
          localUri = await captureFromFallbackSources(fallbackSources);
        }

        if (!localUri) {
          throw new Error(
            "Could not capture this view. Try again after clips finish loading."
          );
        }

        pendingPreviewUriRef.current = localUri;
        const uploadedKey = await uploadPng(localUri);
        const imageKey = await resolveImageKeyAfterUpload(uploadedKey);
        await refreshScreenshots();
        setCaptureCount((n) => n + 1);
        setScreenshotKeys((prev) => [...new Set([...prev, imageKey])]);
        onCaptured?.({ localUri, imageKey });
      } catch (e: unknown) {
        await disposePendingPreview();
        const msg = e instanceof Error ? e.message : "Could not save screenshot.";
        if (__DEV__) console.warn("[meeting] screenshot failed", e);
        Alert.alert("Screenshot failed", msg);
      } finally {
        setCapturing(false);
      }
    },
    [
      captureFromFallbackSources,
      captureViewShot,
      disposePendingPreview,
      isTrainer,
      onCaptured,
      refreshScreenshots,
      resolveImageKeyAfterUpload,
      uploadPng,
    ]
  );

  return {
    captureTargetRef,
    takeScreenshot,
    capturing,
    captureCount,
    screenshotKeys,
    refreshScreenshots,
    disposePendingPreview,
    hasCaptures: captureCount > 0 || screenshotKeys.length > 0,
  };
};
