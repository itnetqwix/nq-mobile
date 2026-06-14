import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { Alert, Platform } from "react-native";

function extensionFromUrl(url: string): string {
  const path = url.split("?")[0] ?? "";
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext && ["mp4", "mov", "mpeg", "webm", "m4v"].includes(ext)) return ext;
  return "mp4";
}

/**
 * Downloads a remote or local video URI into the device photo library.
 */
export async function downloadVideoToLibrary(params: {
  uri: string;
  title?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}): Promise<boolean> {
  const { uri, title, onSuccess, onError } = params;
  if (!uri?.trim()) {
    onError?.("No video URL to download.");
    return false;
  }

  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) {
    onError?.("Photo library access is required to save videos.");
    return false;
  }

  try {
    let localUri = uri;
    if (uri.startsWith("http://") || uri.startsWith("https://")) {
      const ext = extensionFromUrl(uri);
      const dest = `${FileSystem.cacheDirectory}nq_clip_${Date.now()}.${ext}`;
      const result = await FileSystem.downloadAsync(uri, dest);
      localUri = result.uri;
    }

    const asset = await MediaLibrary.createAssetAsync(localUri);
    const albumName = "NetQwix";
    const album = await MediaLibrary.getAlbumAsync(albumName);
    if (album) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    } else {
      await MediaLibrary.createAlbumAsync(albumName, asset, false);
    }

    onSuccess?.();
    return true;
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not save the video to your library.";
    onError?.(message);
    if (Platform.OS === "android") {
      Alert.alert("Download failed", message);
    }
    return false;
  }
}
