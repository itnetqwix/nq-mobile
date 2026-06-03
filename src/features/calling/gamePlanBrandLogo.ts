import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

import { brandImages } from "../../constants/images";

let cachedLogoDataUrl: string | null = null;

/** Inline NetQwix wordmark for expo-print HTML (remote URLs are not loaded). */
export async function getNetQwixLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const asset = Asset.fromModule(brandImages.netqwixFullLogo);
    await asset.downloadAsync();
    const localUri = asset.localUri ?? asset.uri;
    if (!localUri) return null;
    const b64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    cachedLogoDataUrl = `data:image/png;base64,${b64}`;
    return cachedLogoDataUrl;
  } catch {
    return null;
  }
}
