import * as FileSystem from "expo-file-system/legacy";
import { apiClient } from "../api/client";
import { API_ROUTES } from "../config/apiRoutes";
import { extractPresignedPutUrl } from "./http/extractPresignedUrl";

/** Extract bare S3 object key from a stored key or public URL. */
export function s3KeyFromMediaUri(uri: string): string | null {
  const raw = String(uri ?? "").trim();
  if (!raw || raw.startsWith("file://") || raw.startsWith("data:")) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const pathname = new URL(raw).pathname.replace(/^\/+/, "");
      return pathname || null;
    } catch {
      return null;
    }
  }
  return raw.replace(/^\/+/, "") || null;
}

/** Presigned GET when possible, then cache locally for in-app PDF preview. */
export async function resolvePdfForViewing(sourceUri: string): Promise<{
  localUri: string;
  accessUrl: string;
}> {
  let accessUrl = sourceUri;
  const key = s3KeyFromMediaUri(sourceUri);
  if (key && !sourceUri.startsWith("file://")) {
    try {
      const res = await apiClient.post(API_ROUTES.common.fileDownloadUrl, { key });
      const signed = extractPresignedPutUrl(res.data);
      if (signed) accessUrl = signed;
    } catch {
      /* fall back to direct URL */
    }
  }

  if (accessUrl.startsWith("file://")) {
    return { localUri: accessUrl, accessUrl };
  }

  const dest = `${FileSystem.cacheDirectory}locker-pdf-${Date.now()}.pdf`;
  const dl = await FileSystem.downloadAsync(accessUrl, dest);
  if (dl.status < 200 || dl.status >= 300) {
    throw new Error("Could not download PDF.");
  }
  return { localUri: dl.uri, accessUrl };
}
