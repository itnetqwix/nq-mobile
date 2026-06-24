import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";

export type PickedCaptureVideo = ImagePicker.ImagePickerAsset;

export async function pickVideoFromPhotoLibrary(): Promise<PickedCaptureVideo | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Photo library access",
      "Allow photo library access to import a video from your device."
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["videos"],
    videoMaxDuration: 300,
    quality: 1,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

/** Opens system file browser — includes iCloud Drive, Google Drive, and on-device files. */
export async function pickVideoFromFiles(): Promise<PickedCaptureVideo | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "video/*",
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? "video/mp4",
    fileName: asset.name,
    fileSize: asset.size,
  };
}

export function promptImportCapturedVideo(
  onPicked: (asset: PickedCaptureVideo) => void
): void {
  Alert.alert(
    "Import video",
    Platform.OS === "ios"
      ? "Choose from your photo library or browse iCloud Drive and other file sources."
      : "Choose from your gallery or browse Google Drive and other file apps.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Photo library",
        onPress: () => {
          void (async () => {
            const asset = await pickVideoFromPhotoLibrary();
            if (asset) onPicked(asset);
          })();
        },
      },
      {
        text: Platform.OS === "ios" ? "Browse files" : "Files / Drive",
        onPress: () => {
          void (async () => {
            const asset = await pickVideoFromFiles();
            if (asset) onPicked(asset);
          })();
        },
      },
    ]
  );
}
