import { useEffect } from "react";
import { onSessionExpired } from "../../../lib/auth/sessionEvents";
import { navigateToSystemState } from "../navigation/linkActions";

/** When the API returns 401, show the session-expired screen before auth teardown. */
export function useSessionExpiredNavigation() {
  useEffect(() => {
    return onSessionExpired(() => {
      navigateToSystemState("session_expired");
    });
  }, []);
}
