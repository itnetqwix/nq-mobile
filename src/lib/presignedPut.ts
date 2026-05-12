import * as FileSystem from "expo-file-system/legacy";

/**
 * PUT raw file bytes to a presigned S3 URL (same headers as web `UploadClipCard.pushToS3`).
 */
export async function putFileToPresignedUrl(
  presignedUrl: string,
  localFileUri: string,
  contentType: string
): Promise<void> {
  const result = await FileSystem.uploadAsync(presignedUrl, localFileUri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": "inline",
    },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed with HTTP ${result.status}`);
  }
}
