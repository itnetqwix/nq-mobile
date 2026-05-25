import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

/**
 * Self-serve account deletion. The backend soft-deletes the user, scrambles
 * PII, and revokes every active session. Caller should immediately clear
 * local tokens / `signOut()` after a successful call.
 */
export async function requestAccountDeletion(reason?: string): Promise<void> {
  await apiClient.delete(API_ROUTES.user.deleteMe, {
    data: reason ? { reason } : undefined,
  });
}
