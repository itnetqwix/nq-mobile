import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";

export async function requestScreenshotUpload(payload: {
  sessions: string;
  trainer: string;
  trainee: string;
}): Promise<{ data?: { url?: string } }> {
  const res = await apiClient.post(API_ROUTES.report.addImage, payload);
  return res.data;
}

export async function fetchSessionReport(payload: {
  sessions: string;
  trainer: string;
  trainee: string;
}) {
  const res = await apiClient.post(API_ROUTES.report.get, payload);
  return res.data;
}

/** Replace an existing report image key after crop (returns presigned PUT url). */
export async function requestCropImageUpload(payload: {
  sessions: string;
  trainer: string;
  trainee: string;
  oldFile: string;
}) {
  const res = await apiClient.post(API_ROUTES.report.cropImage, payload);
  return res.data;
}

export async function removeReportImage(payload: {
  sessions: string;
  trainer: string;
  trainee: string;
  filename: string;
}) {
  const res = await apiClient.post(API_ROUTES.report.removeImage, payload);
  return res.data;
}
