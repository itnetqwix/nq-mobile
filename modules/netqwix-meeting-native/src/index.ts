import { Platform } from "react-native";

type NetQwixMeetingNative = {
  isPipSupported: () => boolean;
  enterPipMode: (width: number, height: number) => Promise<void>;
  exitPipMode: () => Promise<void>;
  composeLessonRecording: (
    framePaths: string[],
    audioPath: string | null,
    frameDurationMs: number
  ) => Promise<string>;
};

let native: NetQwixMeetingNative | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { requireNativeModule } = require("expo-modules-core") as {
    requireNativeModule: (name: string) => NetQwixMeetingNative;
  };
  native = requireNativeModule("NetQwixMeeting");
} catch {
  native = null;
}

/** Android uses native PiP; iOS uses react-native-webrtc `iosPIP` on `MeetingIosPipHost`. */
export function isMeetingPipSupported(): boolean {
  if (Platform.OS === "ios") {
    if (typeof Platform.Version === "string") {
      const major = parseInt(String(Platform.Version).split(".")[0], 10);
      return major >= 15;
    }
    return Number(Platform.Version) >= 15;
  }
  if (native?.isPipSupported) {
    try {
      return native.isPipSupported();
    } catch {
      return false;
    }
  }
  return Platform.OS === "android";
}

export async function enterMeetingPipMode(
  aspectWidth = 9,
  aspectHeight = 16
): Promise<boolean> {
  if (Platform.OS === "ios") {
    return isMeetingPipSupported();
  }
  if (!native?.enterPipMode) return false;
  try {
    await native.enterPipMode(aspectWidth, aspectHeight);
    return true;
  } catch {
    return false;
  }
}

export async function exitMeetingPipMode(): Promise<void> {
  if (Platform.OS === "ios") return;
  try {
    await native?.exitPipMode?.();
  } catch {
    /* ignore */
  }
}

export type ComposeLessonRecordingOptions = {
  frameUris: string[];
  audioUri?: string | null;
  frameDurationMs?: number;
};

/**
 * Muxes stage snapshots + optional lesson audio into one MP4 (H.264 + AAC when audio present).
 */
export async function composeLessonRecording(
  options: ComposeLessonRecordingOptions
): Promise<string | null> {
  const { frameUris, audioUri = null, frameDurationMs = 12_000 } = options;
  if (!native?.composeLessonRecording || frameUris.length < 2) {
    return null;
  }
  try {
    const uri = await native.composeLessonRecording(
      frameUris,
      audioUri,
      frameDurationMs
    );
    return uri || null;
  } catch (e) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[composeLessonRecording] failed", e);
    }
    return null;
  }
}
