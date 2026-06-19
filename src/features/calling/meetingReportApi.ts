import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function postWithRetry<T>(
  url: string,
  payload: unknown,
  attempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await apiClient.post(url, payload);
      return res.data as T;
    } catch (err) {
      lastError = err;
      const isNetwork =
        err instanceof Error &&
        (/network error/i.test(err.message) || err.message === "Network Error");
      if (!isNetwork || i === attempts - 1) throw err;
      await delay(600 * (i + 1));
    }
  }
  throw lastError;
}

export async function requestScreenshotUpload(payload: {
  sessions: string;
  trainer: string;
  trainee: string;
}): Promise<{ data?: { url?: string } }> {
  return postWithRetry(API_ROUTES.report.addImage, payload);
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

export async function saveSessionGamePlan(payload: {
  sessions: string;
  trainer: string;
  trainee: string;
  title: string;
  topic: string;
  reportData: Array<{ imageUrl: string; title?: string; description?: string }>;
  publish: boolean;
}) {
  return postWithRetry(API_ROUTES.report.create, payload);
}

export async function retryGamePlanPdf(payload: {
  sessions: string;
  trainer: string;
  trainee: string;
}) {
  const res = await apiClient.post(API_ROUTES.report.retryPdf, payload);
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
