import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

function extractArray(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return [];
  const root = body as Record<string, unknown>;
  const nested = root.data ?? root.result;
  return Array.isArray(nested) ? (nested as Record<string, unknown>[]) : [];
}

export async function fetchFavoriteTrainers(): Promise<Record<string, unknown>[]> {
  const res = await apiClient.get(API_ROUTES.trainee.favoriteTrainers);
  return extractArray(res.data);
}

export async function addFavoriteTrainer(trainerId: string): Promise<void> {
  await apiClient.post(API_ROUTES.trainee.favoriteTrainer(trainerId));
}

export async function removeFavoriteTrainer(trainerId: string): Promise<void> {
  await apiClient.delete(API_ROUTES.trainee.favoriteTrainer(trainerId));
}
