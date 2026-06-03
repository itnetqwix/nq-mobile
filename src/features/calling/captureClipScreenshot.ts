import * as VideoThumbnails from "expo-video-thumbnails";

/** Per-clip frame grab; parallel for dual-clip keeps total near one round-trip. */
const THUMBNAIL_TIMEOUT_MS = 1_400;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** Frame grab at playback position (seconds) for screenshot upload. */
export async function captureClipFrameUri(
  videoUri: string,
  progressSeconds: number
): Promise<string | null> {
  try {
    const ms = Math.max(0, Math.floor(progressSeconds * 1000));
    const result = await withTimeout(
      VideoThumbnails.getThumbnailAsync(videoUri, {
        time: ms,
        quality: 0.82,
      }),
      THUMBNAIL_TIMEOUT_MS
    );
    if (!result) return null;
    return result.uri ?? null;
  } catch (e) {
    if (__DEV__) console.warn("[screenshot] thumbnail failed", e);
    return null;
  }
}

export async function captureClipFrames(
  sources: { uri: string; progressSeconds: number }[]
): Promise<string[]> {
  const valid = sources.filter((s) => !!s.uri);
  if (valid.length === 0) return [];

  const frames = await Promise.all(
    valid.map((s) => captureClipFrameUri(s.uri, s.progressSeconds))
  );
  return frames.filter((f): f is string => !!f);
}
