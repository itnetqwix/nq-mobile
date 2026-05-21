import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View, type LayoutChangeEvent } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";
import { putFileToPresignedUrl } from "../../lib/presignedPut";

import { captureClipFrames } from "./captureClipScreenshot";
import { fetchSessionReport, requestScreenshotUpload } from "./meetingReportApi";

export type ScreenshotCaptureSource = {
  uri: string;
  progressSeconds: number;
};

type Args = {
  sessionId: string;
  trainerId: string;
  traineeId: string;
  isTrainer: boolean;
  onUploaded?: (imageKey: string) => void;
};

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

export function useMeetingScreenshot({
  sessionId,
  trainerId,
  traineeId,
  isTrainer,
  onUploaded,
}: Args) {
  const captureTargetRef = useRef<View>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [screenshotKeys, setScreenshotKeys] = useState<string[]>([]);
  const [compositeFrameUris, setCompositeFrameUris] = useState<string[] | null>(null);
  const [compositeLayoutReady, setCompositeLayoutReady] = useState(false);
  const capturePendingRef = useRef(false);

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

  const uploadJpeg = useCallback(
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
      const imageKey = extractImageKeyFromPresignResponse(presign, uploadUrl);
      try {
        const normalized = localUri.split("?")[0];
        const info = await FileSystem.getInfoAsync(normalized);
        if (info.exists) {
          await FileSystem.deleteAsync(normalized, { idempotent: true });
        }
      } catch {
        /** best-effort */
      }
      return imageKey;
    },
    [sessionId, traineeId, trainerId]
  );

  const finishCapture = useCallback(
    async (localUri: string) => {
      const uploadedKey = await uploadJpeg(localUri);
      await refreshScreenshots();
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
        /** use uploadedKey */
      }
      setCaptureCount((n) => n + 1);
      setScreenshotKeys((prev) => [...new Set([...prev, imageKey])]);
      onUploaded?.(imageKey);
    },
    [onUploaded, refreshScreenshots, sessionId, trainerId, traineeId, uploadJpeg]
  );

  useEffect(() => {
    if (!compositeFrameUris?.length || !compositeLayoutReady || !capturePendingRef.current) {
      return;
    }
    const run = async () => {
      try {
        if (!captureTargetRef.current) {
          throw new Error("Capture view not ready");
        }
        const uri = await captureRef(captureTargetRef, {
          format: "jpg",
          quality: 0.9,
          result: "tmpfile",
        });
        await finishCapture(uri);
      } catch (e: any) {
        if (__DEV__) console.warn("[meeting] screenshot composite failed", e);
        Alert.alert("Screenshot failed", e?.message ?? "Could not save screenshot.");
      } finally {
        capturePendingRef.current = false;
        setCompositeFrameUris(null);
        setCompositeLayoutReady(false);
        setCapturing(false);
      }
    };
    void run();
  }, [compositeFrameUris, compositeLayoutReady, finishCapture]);

  const takeScreenshot = useCallback(
    async (sources: ScreenshotCaptureSource[]) => {
      if (!isTrainer) return;
      if (!sources.length) {
        Alert.alert("Screenshot", "No clips to capture.");
        return;
      }
      setCapturing(true);
      try {
        const frames = await captureClipFrames(sources);
        if (frames.length === 0) {
          throw new Error("Could not capture clip frames. Wait for clips to load.");
        }
        if (frames.length === 1) {
          await finishCapture(frames[0]);
          setCapturing(false);
          return;
        }
        capturePendingRef.current = true;
        setCompositeLayoutReady(false);
        setCompositeFrameUris(frames);
      } catch (e: any) {
        if (__DEV__) console.warn("[meeting] screenshot failed", e);
        Alert.alert("Screenshot failed", e?.message ?? "Could not save screenshot.");
        setCapturing(false);
      }
    },
    [finishCapture, isTrainer]
  );

  const onCompositeLayout = useCallback((_e: LayoutChangeEvent) => {
    setCompositeLayoutReady(true);
  }, []);

  return {
    captureTargetRef,
    takeScreenshot,
    capturing,
    captureCount,
    screenshotKeys,
    refreshScreenshots,
    hasCaptures: captureCount > 0 || screenshotKeys.length > 0,
    compositeFrameUris,
    onCompositeLayout,
  };
};
