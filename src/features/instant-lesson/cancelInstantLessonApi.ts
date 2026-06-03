import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { unwrapApiData } from "../../lib/http/unwrapApiData";

export async function cancelInstantLesson(lessonId: string): Promise<{
  ok: boolean;
  refund?: { refunded: boolean; error?: string };
}> {
  const res = await apiClient.post(API_ROUTES.trainee.cancelInstantLesson, {
    lessonId,
  });
  return unwrapApiData<{ ok: boolean; refund?: { refunded: boolean; error?: string } }>(res);
}
