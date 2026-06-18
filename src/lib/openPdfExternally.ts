import * as FileSystem from "expo-file-system/legacy";
import { Linking, Platform, Share } from "react-native";

/** Open a PDF via the system share sheet or browser — no optional native modules. */
export async function openPdfWithSystemFallback(
  localUri: string | null,
  accessUrl: string | null,
  fallbackUri: string
): Promise<boolean> {
  if (localUri) {
    try {
      let shareUrl = localUri;
      if (Platform.OS === "android" && localUri.startsWith("file://")) {
        try {
          shareUrl = await FileSystem.getContentUriAsync(localUri);
        } catch {
          shareUrl = localUri;
        }
      }
      await Share.share(
        Platform.OS === "ios"
          ? { url: shareUrl }
          : { message: shareUrl, url: shareUrl }
      );
      return true;
    } catch {
      /* fall through to Linking */
    }
  }

  const target = accessUrl ?? fallbackUri;
  try {
    const can = await Linking.canOpenURL(target);
    if (!can) return false;
    await Linking.openURL(target);
    return true;
  } catch {
    return false;
  }
}
