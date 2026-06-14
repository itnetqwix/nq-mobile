import * as FileSystem from "expo-file-system/legacy";
import { Share } from "react-native";
import type { DataExportBundle } from "../api/privacyApi";

/** Writes the inline API bundle to app storage and opens the system share sheet. */
export async function saveAndShareDataExportBundle(bundle: DataExportBundle): Promise<string> {
  const root = FileSystem.documentDirectory ?? "";
  const dir = `${root}exports/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `${dir}netqwix-export-${stamp}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(bundle, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Share.share({
    url: path,
    title: "NetQwix data export",
    message: "NetQwix personal data export",
  });

  return path;
}
