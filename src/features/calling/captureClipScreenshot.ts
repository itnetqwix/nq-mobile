import * as VideoThumbnails from "expo-video-thumbnails";

/** Per-clip frame grab; parallel for dual-clip. Slower CDN needs more time on cellular. */
const THUMBNAIL_TIMEOUT_MS = 4_500;
const THUMBNAIL_RETRY_TIMEOUT_MS = 6_500;

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
  const ms = Math.max(0, Math.floor(progressSeconds * 1000));
  const attempt = async (timeoutMs: number) => {
    try {
      const result = await withTimeout(
        VideoThumbnails.getThumbnailAsync(videoUri, {
          time: ms,
          quality: 0.82,
        }),
        timeoutMs
      );
      return result?.uri ?? null;
    } catch (e) {
      if (__DEV__) console.warn("[screenshot] thumbnail failed", e);
      return null;
    }
  };

  const first = await attempt(THUMBNAIL_TIMEOUT_MS);
  if (first) return first;
  return attempt(THUMBNAIL_RETRY_TIMEOUT_MS);
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
