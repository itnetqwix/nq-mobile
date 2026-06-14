import { useEffect } from "react";
import { onSessionExpired } from "../../../lib/auth/sessionEvents";
import { navigateToSystemState } from "../navigation/linkActions";
import { store } from "../../../store/store";
import { clearSessionLocalThunk } from "../../../store/slices/authSlice";

/** When the API returns 401, clear stale tokens then show session-expired UI. */
export function useSessionExpiredNavigation() {
  useEffect(() => {
    return onSessionExpired(() => {
      void store.dispatch(clearSessionLocalThunk()).finally(() => {
        navigateToSystemState("session_expired");
      });
    });
  }, []);
}
