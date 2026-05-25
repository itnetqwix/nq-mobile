import { isAxiosError } from "axios";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { dedupeTrainersById } from "../../../lib/lists/trainerListUtils";

function extractArray(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return [];
  const root = body as Record<string, unknown>;
  const nested = root.data ?? root.result;
  return Array.isArray(nested) ? (nested as Record<string, unknown>[]) : [];
}

/**
 * Favorites endpoints are trainee-only — backend returns 401 for trainers
 * even when the session is valid. The interceptor needs to skip the
 * global sign-out path so a trainer browsing the trainee dashboard
 * doesn't get bounced to the login screen.
 */
const favoritesRequestConfig = { _skipAuthSignOut: true };

export async function fetchFavoriteTrainers(): Promise<Record<string, unknown>[]> {
  try {
    const res = await apiClient.get(API_ROUTES.trainee.favoriteTrainers, favoritesRequestConfig);
    return dedupeTrainersById(extractArray(res.data));
  } catch (e) {
    if (isAxiosError(e) && e.response?.status === 401) {
      return [];
    }
    throw e;
  }
}

export async function addFavoriteTrainer(trainerId: string): Promise<void> {
  await apiClient.post(API_ROUTES.trainee.favoriteTrainer(trainerId), undefined, favoritesRequestConfig);
}

export async function removeFavoriteTrainer(trainerId: string): Promise<void> {
  await apiClient.delete(API_ROUTES.trainee.favoriteTrainer(trainerId), favoritesRequestConfig);
}
