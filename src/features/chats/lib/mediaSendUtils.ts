import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

export async function getPresignedUploadUrl(fileName: string, fileType: string) {
  const res = await apiClient.post(API_ROUTES.chat.mediaUploadUrl, { fileName, fileType });
  const body = (res as any)?.data ?? res;
  if (!body?.uploadUrl) throw new Error(body?.message ?? "Failed to get upload URL");
  return {
    uploadUrl: body.uploadUrl as string,
    mediaUrl: body.mediaUrl as string,
    key: body.key as string | undefined,
  };
}

/** Remove an S3 object when PUT succeeded but /chat-send failed. */
export async function abortChatMediaUpload(key: string | undefined) {
  if (!key) return;
  try {
    await apiClient.post(API_ROUTES.chat.mediaUploadAbort, { key });
  } catch {
    /* best-effort orphan cleanup */
  }
}

export async function uploadToS3(uploadUrl: string, fileUri: string, contentType: string) {
  const response = await fetch(fileUri);
  const blob = await response.blob();
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);
}

export function isNetworkSendError(e: unknown): boolean {
  const err = e as { response?: unknown; code?: string; message?: string };
  return (
    !err?.response &&
    (err?.code === "ERR_NETWORK" ||
      err?.code === "ECONNABORTED" ||
      err?.message === "Network Error" ||
      String(err?.message ?? "").includes("Network request failed"))
  );
}
