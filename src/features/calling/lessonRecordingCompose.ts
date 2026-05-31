import { composeLessonRecording as nativeCompose } from "netqwix-meeting-native";
import { LESSON_STAGE_FRAME_INTERVAL_MS } from "./lessonStageFrameSampler";

export async function muxLessonRecordingUpload(params: {
  frameUris: string[];
  audioUri: string | null;
}): Promise<{ uri: string; format: "mp4" | "m4a" } | null> {
  const { frameUris, audioUri } = params;

  if (frameUris.length >= 2) {
    const mp4 = await nativeCompose({
      frameUris,
      audioUri,
      frameDurationMs: LESSON_STAGE_FRAME_INTERVAL_MS,
    });
    if (mp4) {
      return { uri: mp4, format: "mp4" };
    }
  }

  if (audioUri) {
    return { uri: audioUri, format: "m4a" };
  }

  return null;
}
