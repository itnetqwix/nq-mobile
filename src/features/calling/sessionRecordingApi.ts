import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { putFileToPresignedUrl } from "../../lib/presignedPut";

export type SessionRecordingFormat = "webm" | "m4a" | "mp4";

export async function requestSessionRecordingUpload(payload: {
  sessions: string;
  trainee: string;
  format?: SessionRecordingFormat;
}): Promise<string> {
  const res = await apiClient.post(API_ROUTES.report.addSessionRecording, {
    sessions: payload.sessions,
    trainee: payload.trainee,
    format: payload.format ?? "webm",
  });
  const body = res.data as { data?: { url?: string }; url?: string };
  const url = body?.data?.url ?? body?.url;
  if (!url || typeof url !== "string") {
    throw new Error("Could not prepare session recording upload.");
  }
  return url;
}

export async function uploadSessionRecordingFile(
  presignedUrl: string,
  localUri: string,
  format: SessionRecordingFormat = "webm"
): Promise<void> {
  const contentType =
    format === "m4a" ? "audio/mp4" : format === "mp4" ? "video/mp4" : "video/webm";
  await putFileToPresignedUrl(presignedUrl, localUri, contentType);
}
