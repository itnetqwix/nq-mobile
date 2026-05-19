import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

export async function getPresignedChatUploadUrl(fileName: string, fileType: string) {
  const res = await apiClient.post(API_ROUTES.chat.mediaUploadUrl, { fileName, fileType });
  const body = (res as any)?.data ?? res;
  if (!body?.uploadUrl) throw new Error(body?.message ?? "Failed to get upload URL");
  return { uploadUrl: body.uploadUrl as string, mediaUrl: body.mediaUrl as string };
}

export async function uploadChatFileToS3(
  uploadUrl: string,
  fileUri: string,
  contentType: string
) {
  const response = await fetch(fileUri);
  const blob = await response.blob();
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!res.ok) throw new Error("Upload failed");
}
