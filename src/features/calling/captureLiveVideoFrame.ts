import { Platform, type RefObject } from "react-native";
import { captureRef } from "react-native-view-shot";
import type { View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import type { MediaStream } from "react-native-webrtc";

const MIN_CAPTURE_BYTES = 6_000;
const LIVE_CAPTURE_WIDTH = 1080;
const LIVE_CAPTURE_JPEG_QUALITY = 0.96;

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** True when the stream has at least one live, enabled video track. */
export function isMediaStreamVideoReady(stream: MediaStream | null | undefined): boolean {
  if (!stream?.getVideoTracks) return false;
  return stream.getVideoTracks().some(
    (t) => t.readyState === "live" && t.enabled !== false
  );
}

async function tryCaptureRef(
  ref: RefObject<View | null>,
  options: Record<string, unknown>
): Promise<string | null> {
  if (!ref.current) return null;
  try {
    const uri = await captureRef(ref, {
      format: "jpg",
      quality: LIVE_CAPTURE_JPEG_QUALITY,
      result: "tmpfile",
      width: LIVE_CAPTURE_WIDTH,
      ...options,
    });
    const normalized = uri.split("?")[0];
    const info = await FileSystem.getInfoAsync(normalized);
    if (info.exists && "size" in info && typeof info.size === "number") {
      if (info.size >= MIN_CAPTURE_BYTES) return uri;
    }
  } catch (e) {
    if (__DEV__) console.warn("[meeting] live view-shot attempt failed", e);
  }
  return null;
}

/**
 * Multi-strategy capture for RTCView — iOS often needs several attempts and
 * `renderInContext` when `texture` returns a white frame.
 */
export async function captureLiveVideoFrame(
  ref: RefObject<View | null>,
  options?: { maxAttempts?: number; settleMs?: number }
): Promise<string | null> {
  const maxAttempts = options?.maxAttempts ?? 4;
  const settleMs = options?.settleMs ?? 72;

  const strategies: Record<string, unknown>[] =
    Platform.OS === "ios"
      ? [
          { snapshotContent: "texture" },
          { snapshotContent: "renderInContext" },
          {},
        ]
      : [{}, { snapshotContent: "texture" }];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await delay(settleMs + attempt * 48);
    for (const strategy of strategies) {
      const uri = await tryCaptureRef(ref, strategy);
      if (uri) return uri;
    }
  }
  return null;
}
