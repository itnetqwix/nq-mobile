import axios from "axios";
import { API_BASE_URL } from "../config/env";
import { API_ROUTES } from "../config/apiRoutes";
import { extractLoginTokens } from "../lib/http/parseLoginResponse";
import {
  getAccountType,
  getRefreshToken,
  saveSession,
} from "../features/auth/session/tokenStorage";

let refreshInFlight: Promise<boolean> | null = null;

/** Rotate tokens via POST /auth/refresh (no apiClient — avoids interceptor loops). */
export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refresh_token = await getRefreshToken();
    if (!refresh_token) return false;

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}${API_ROUTES.auth.refresh}`,
        { refresh_token },
        {
          timeout: 30_000,
          headers: { "Content-Type": "application/json" },
        }
      );
      const tokens = extractLoginTokens(data);
      if (!tokens) return false;
      const accountType = (await getAccountType()) ?? tokens.account_type;
      await saveSession(tokens.access_token, accountType, {
        refreshToken: tokens.refresh_token,
        sessionId: tokens.session_id,
      });
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
