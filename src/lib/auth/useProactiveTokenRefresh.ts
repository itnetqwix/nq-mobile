import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { refreshAccessToken } from "../../api/authRefresh";
import { getAccessToken } from "../../features/auth/session/tokenStorage";
import { accessTokenExpiresWithin } from "./jwtUtils";

const CHECK_INTERVAL_MS = 60_000;
/** Refresh when less than 5 minutes remain on the access JWT. */
const REFRESH_WITHIN_SECONDS = 300;

/**
 * Keeps the access token warm while the user is signed in.
 * Complements the 401 interceptor — avoids mid-action failures on short-lived JWTs.
 */
export function useProactiveTokenRefresh(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const maybeRefresh = async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;
      if (accessTokenExpiresWithin(token, REFRESH_WITHIN_SECONDS)) {
        await refreshAccessToken();
      }
    };

    void maybeRefresh();
    const interval = setInterval(() => void maybeRefresh(), CHECK_INTERVAL_MS);

    const onAppState = (state: AppStateStatus) => {
      if (state === "active") void maybeRefresh();
    };
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [enabled]);
}
