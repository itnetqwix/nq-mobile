import { useCallback, useRef, useState, type RefObject } from "react";
import { Alert, Dimensions, PixelRatio, Platform, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";
import { putFileToPresignedUrl } from "../../lib/presignedPut";
import {
  extractPresignedFilename,
  extractPresignedPutUrl,
} from "../../lib/http/extractPresignedUrl";

import {
  captureClipFrameUri,
  captureClipFrames,
} from "./captureClipScreenshot";
import { normalizeReportImageKeys } from "./reportDataUtils";
import { requestScreenshotUpload, fetchSessionReport } from "./meetingReportApi";

export type ScreenshotCaptureSource = {
  uri: string;
  progressSeconds: number;
};

export type ScreenshotCapturedPayload = {
  localUri: string;
  /** Set when S3 upload finishes (may arrive after modal opens). */
  imageKey: string | null;
};

export type CaptureStage = "idle" | "capturing";

type Args = {
  sessionId: string;
  trainerId: string;
  traineeId: string;
  isTrainer: boolean;
  onCaptured?: (payload: ScreenshotCapturedPayload) => void;
  /** Called when background upload completes so UI can enable Save. */
  onUploadReady?: (imageKey: string) => void;
  onUploadFailed?: (message: string) => void;
  /** Burn Skia annotations onto clip thumbnails / unreliable view-shot frames. */
  applyAnnotationBurnIn?: (localUri: string) => Promise<string | null>;
  /** Dedicated off-screen RTCView capture (live lesson, no clips). */
  captureLiveFrame?: () => Promise<string | null>;
  isLiveVideoReady?: () => boolean;
  /** Fired when a new upload starts (e.g. after crop replaces the file). */
  onUploadRestart?: () => void;
};

const CAPTURE_SETTLE_MS = 32;
const COMPOSITE_LAYOUT_DELAY_MS = 100;
const MIN_CAPTURE_BYTES = 6_000;
const UPLOAD_MIME = "image/jpeg";
const CAPTURE_JPEG_QUALITY = 0.96;
const SCREEN_CAPTURE_WIDTH = Math.min(
  1440,
  Math.round(Dimensions.get("window").width * PixelRatio.get())
);

function extractImageKeyFromPresignResponse(
  presignBody: unknown,
  uploadUrl: string
): string {
  const fromBody = extractPresignedFilename(presignBody);
  if (fromBody) return fromBody;
  const path = uploadUrl.split("?")[0];
  const parts = path.split("/");
  return parts[parts.length - 1] || `file-${Date.now()}.jpg`;
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
  onUploadReady,
  onUploadFailed,
  applyAnnotationBurnIn,
  captureLiveFrame,
  isLiveVideoReady,
  onUploadRestart,
}: Args) {
  const captureTargetRef = useRef<View>(null);
  const compositeHostRef = useRef<View>(null);
  const pendingPreviewUriRef = useRef<string | null>(null);
  const uploadGenerationRef = useRef(0);
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
    async (localUri: string, presignBody: unknown) => {
      const uploadUrl = extractPresignedPutUrl(presignBody);
      if (!uploadUrl) {
        throw new Error("No upload URL returned");
      }
      await putFileToPresignedUrl(uploadUrl, localUri, UPLOAD_MIME);
      return extractImageKeyFromPresignResponse(presignBody, uploadUrl);
    },
    []
  );

  const tryViewShot = useCallback(
    async (ref: RefObject<View | null>, extra?: Record<string, unknown>) => {
      if (!ref.current) return null;
      try {
        const uri = await captureRef(ref, {
          format: "jpg",
          quality: CAPTURE_JPEG_QUALITY,
          result: "tmpfile",
          width: SCREEN_CAPTURE_WIDTH,
          ...extra,
        });
        const normalized = uri.split("?")[0];
        const info = await FileSystem.getInfoAsync(normalized);
        if (info.exists && "size" in info && typeof info.size === "number") {
          if (info.size >= MIN_CAPTURE_BYTES) return uri;
        }
      } catch (e) {
        if (__DEV__) console.warn("[meeting] view-shot capture failed", e);
      }
      return null;
    },
    []
  );

  const captureViewShot = useCallback(
    async (ref: RefObject<View | null>) => {
      const strategies =
        Platform.OS === "ios"
          ? [{ snapshotContent: "texture" as const }, { snapshotContent: "renderInContext" as const }, {}]
          : [{}, { snapshotContent: "texture" as const }];
      for (const strategy of strategies) {
        const uri = await tryViewShot(ref, strategy);
        if (uri) return uri;
      }
      return null;
    },
    [tryViewShot]
  );

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
      await delay(24);
      const uri = await captureViewShot(compositeHostRef);
      setCompositeFrameUris([]);
      framesReadyPromiseRef.current = null;
      return uri;
    },
    [captureViewShot]
  );

  const captureFromClipSources = useCallback(
    async (sources: ScreenshotCaptureSource[]) => {
      const valid = sources.filter((s) => !!s.uri);
      if (!valid.length) return null;

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

  const runBackgroundUpload = useCallback(
    (localUri: string, presignPromise: Promise<unknown>, generation: number) => {
      void (async () => {
        try {
          const presignBody = await presignPromise;
          if (uploadGenerationRef.current !== generation) return;
          const imageKey = await uploadPng(localUri, presignBody);
          if (uploadGenerationRef.current !== generation) return;
          setCaptureCount((n) => n + 1);
          setScreenshotKeys((prev) => [...new Set([...prev, imageKey])]);
          onUploadReady?.(imageKey);
        } catch (e: unknown) {
          if (uploadGenerationRef.current !== generation) return;
          const msg =
            e instanceof Error ? e.message : "Could not upload screenshot.";
          onUploadFailed?.(msg);
          if (__DEV__) console.warn("[meeting] screenshot upload failed", e);
        }
      })();
    },
    [onUploadFailed, onUploadReady, uploadPng]
  );

  const takeScreenshot = useCallback(
    async (clipSourcesExplicit?: ScreenshotCaptureSource[]) => {
      if (!isTrainer) return;
      setCapturing(true);
      setCaptureStage("capturing");
      const generation = ++uploadGenerationRef.current;

      const presignPromise = requestScreenshotUpload({
        sessions: sessionId,
        trainer: trainerId,
        trainee: traineeId,
      });

      try {
        await delay(CAPTURE_SETTLE_MS);

        const clipSources =
          clipSourcesExplicit && clipSourcesExplicit.length > 0
            ? clipSourcesExplicit
            : undefined;

        let localUri: string | null = null;

        if (clipSources?.length) {
          localUri = await captureViewShot(captureTargetRef);
          if (!localUri) {
            localUri = await captureFromClipSources(clipSources);
          }
        } else {
          const liveReady = isLiveVideoReady?.() ?? false;
          if (liveReady && captureLiveFrame) {
            await delay(96);
            localUri = await captureLiveFrame();
          }
          if (!localUri) {
            localUri = await captureViewShot(captureTargetRef);
          }
          if (!localUri && liveReady && captureLiveFrame) {
            await delay(160);
            localUri = await captureLiveFrame();
          }
        }

        if (!localUri) {
          throw new Error(
            "Could not capture this frame. Wait until the lesson view is visible and try again."
          );
        }

        if (applyAnnotationBurnIn) {
          try {
            const burned = await applyAnnotationBurnIn(localUri);
            if (burned) localUri = burned;
          } catch (e) {
            if (__DEV__) console.warn("[meeting] annotation burn-in failed", e);
          }
        }

        pendingPreviewUriRef.current = localUri;

        /** Frame is ready — hide blocker and open details while S3 upload runs. */
        setCapturing(false);
        setCaptureStage("idle");
        onCaptured?.({ localUri, imageKey: null });

        runBackgroundUpload(localUri, presignPromise, generation);
      } catch (e: unknown) {
        uploadGenerationRef.current += 1;
        await disposePendingPreview();
        setCompositeFrameUris([]);
        const msg = e instanceof Error ? e.message : "Could not save screenshot.";
        if (__DEV__) console.warn("[meeting] screenshot failed", e);
        Alert.alert("Screenshot failed", msg);
        setCapturing(false);
        setCaptureStage("idle");
      }
    },
    [
      captureFromClipSources,
      captureViewShot,
      disposePendingPreview,
      isTrainer,
      onCaptured,
      applyAnnotationBurnIn,
      captureLiveFrame,
      isLiveVideoReady,
      runBackgroundUpload,
      sessionId,
      traineeId,
      trainerId,
    ]
  );

  const captureStageFrame = useCallback(async () => {
    if (isLiveVideoReady?.() && captureLiveFrame) {
      const live = await captureLiveFrame();
      if (live) return live;
    }
    return captureViewShot(captureTargetRef);
  }, [captureLiveFrame, captureViewShot, isLiveVideoReady]);

  const replacePendingUpload = useCallback(
    async (newLocalUri: string) => {
      const generation = ++uploadGenerationRef.current;
      pendingPreviewUriRef.current = newLocalUri;
      onUploadRestart?.();
      const presignPromise = requestScreenshotUpload({
        sessions: sessionId,
        trainer: trainerId,
        trainee: traineeId,
      });
      runBackgroundUpload(newLocalUri, presignPromise, generation);
    },
    [
      onUploadRestart,
      runBackgroundUpload,
      sessionId,
      traineeId,
      trainerId,
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
    captureStageFrame,
    replacePendingUpload,
  };
};
