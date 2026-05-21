import * as VideoThumbnails from "expo-video-thumbnails";

/** Frame grab at playback position (seconds) for screenshot upload. */
export async function captureClipFrameUri(
  videoUri: string,
  progressSeconds: number
): Promise<string | null> {
  try {
    const ms = Math.max(0, Math.floor(progressSeconds * 1000));
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: ms,
      quality: 0.92,
    });
    return uri ?? null;
  } catch (e) {
    if (__DEV__) console.warn("[screenshot] thumbnail failed", e);
    return null;
  }
}

export async function captureClipFrames(
  sources: { uri: string; progressSeconds: number }[]
): Promise<string[]> {
  const out: string[] = [];
  for (const s of sources) {
    if (!s.uri) continue;
    const frame = await captureClipFrameUri(s.uri, s.progressSeconds);
    if (frame) out.push(frame);
  }
  return out;
}
