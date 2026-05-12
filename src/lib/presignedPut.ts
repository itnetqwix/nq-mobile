import * as FileSystem from "expo-file-system/legacy";

export type PresignedPutProgress = {
  loaded: number;
  total: number;
  percent: number;
};

/**
 * PUT raw file bytes to a presigned S3 URL (same headers as web `UploadClipCard.pushToS3`).
 *
 * When `onProgress` is provided, real upload progress is reported via `FileSystem.createUploadTask`
 * (the only progress-aware API on expo-file-system that works without `fetch`/`XHR`).
 */
export async function putFileToPresignedUrl(
  presignedUrl: string,
  localFileUri: string,
  contentType: string,
  onProgress?: (p: PresignedPutProgress) => void
): Promise<void> {
  const headers = {
    "Content-Type": contentType,
    "Content-Disposition": "inline",
  };

  if (!onProgress) {
    const result = await FileSystem.uploadAsync(presignedUrl, localFileUri, {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers,
    });
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Upload failed with HTTP ${result.status}`);
    }
    return;
  }

  const task = FileSystem.createUploadTask(
    presignedUrl,
    localFileUri,
    {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers,
    },
    (data) => {
      const total = data.totalBytesExpectedToSend || 0;
      const loaded = data.totalBytesSent || 0;
      const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      onProgress({ loaded, total, percent });
    }
  );

  const result = await task.uploadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed with HTTP ${result?.status ?? "unknown"}`);
  }
  // Make sure UI reaches 100% even if the last progress tick was throttled.
  onProgress({ loaded: 1, total: 1, percent: 100 });
}
