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
