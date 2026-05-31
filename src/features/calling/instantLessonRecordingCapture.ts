/**
 * Instant-lesson session capture for mobile.
 *
 * Full composited video (web canvas + MediaRecorder) is not available in RN yet.
 * We record lesson audio via expo-av and upload as M4A; locker playback uses the
 * same S3 key flow with `audio/mp4` presign when `format: "m4a"`.
 */

import { Audio } from "expo-av";

export type InstantRecordingCaptureHandle = {
  stop: () => Promise<string | null>;
};

export async function startInstantLessonAudioCapture(): Promise<InstantRecordingCaptureHandle | null> {
  try {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) return null;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    return {
      stop: async () => {
        try {
          await recording.stopAndUnloadAsync();
          return recording.getURI();
        } catch {
          return null;
        } finally {
          try {
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
            });
          } catch {
            /* ignore */
          }
        }
      },
    };
  } catch {
    return null;
  }
}
