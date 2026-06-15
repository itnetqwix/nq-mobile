import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";
import { haptics } from "../../lib/haptics";

async function resolveFileSize(uri: string, reported?: number | null): Promise<number | undefined> {
  if (typeof reported === "number" && reported > 0) return reported;
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (info.exists && "size" in info && typeof info.size === "number" && info.size > 0) {
      return info.size;
    }
  } catch {
    /* size unknown */
  }
  return undefined;
}

export type InlineClipCapture = {
  asset: ImagePicker.ImagePickerAsset;
  thumbUri: string | null;
  fileSizeBytes?: number;
};

type Args = {
  onCaptured: (capture: InlineClipCapture) => void;
};

/** Launch the device camera for a short clip without leaving the current screen. */
export function useInlineClipRecording({ onCaptured }: Args) {
  const [busy, setBusy] = useState(false);

  const startRecording = useCallback(async () => {
    if (busy) return;
    haptics.tap();
    setBusy(true);
    try {
      const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus !== "granted") {
        haptics.error();
        Alert.alert(
          "Camera Access Required",
          "Please grant camera access in Settings to record clips.",
          [{ text: "OK" }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["videos"],
        videoMaxDuration: 120,
        allowsEditing: Platform.OS === "ios",
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      if (!asset?.uri) return;

      haptics.success();
      let thumbUri: string | null = null;
      try {
        const durationSec = asset.duration ?? 2;
        const timeMs = Math.min(60_000, Math.max(250, Math.floor((durationSec / 2) * 1000)));
        const thumb = await VideoThumbnails.getThumbnailAsync(asset.uri, {
          time: timeMs,
          quality: 0.85,
        });
        thumbUri = thumb.uri;
      } catch {
        /* thumbnail optional */
      }

      const fileSizeBytes = await resolveFileSize(asset.uri, asset.fileSize);
      onCaptured({ asset, thumbUri, fileSizeBytes });
    } finally {
      setBusy(false);
    }
  }, [busy, onCaptured]);

  return { startRecording, busy };
}
