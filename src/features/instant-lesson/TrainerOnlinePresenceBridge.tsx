/**
 * Trainer online presence vs app lifecycle:
 * - Stay online while the app is in the background (socket may stay connected).
 * - Mark offline ~30s after the socket disconnects (app force-closed / network drop).
 * - Mark offline immediately on sign-out.
 */

import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "../auth/context/AuthContext";
import { AccountType } from "../../constants/accountType";
import { setOnlineAvailability } from "../home/api/homeApi";
import { resolveShowAsOnline } from "../../lib/user/resolveShowAsOnline";
import { useSocket } from "../socket/SocketContext";

const OFFLINE_AFTER_DISCONNECT_MS = 30_000;

export function TrainerOnlinePresenceBridge() {
  const { status, accountType, user, patchUser } = useAuth();
  const { isConnected } = useSocket();
  const wantsOnlineRef = useRef(false);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const isTrainer = accountType === AccountType.TRAINER && status === "signedIn";

  useEffect(() => {
    wantsOnlineRef.current = isTrainer && resolveShowAsOnline(user);
  }, [isTrainer, user]);

  const clearDisconnectTimer = () => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
  };

  const scheduleOfflineAfterDisconnect = () => {
    if (!wantsOnlineRef.current) return;
    clearDisconnectTimer();
    disconnectTimerRef.current = setTimeout(() => {
      disconnectTimerRef.current = null;
      if (!wantsOnlineRef.current) return;
      void (async () => {
        try {
          await setOnlineAvailability(false);
          patchUser({ showAsOnline: false });
        } catch {
          /* best effort */
        }
      })();
    }, OFFLINE_AFTER_DISCONNECT_MS);
  };

  useEffect(() => {
    if (!isTrainer) {
      clearDisconnectTimer();
      return;
    }

    if (isConnected) {
      clearDisconnectTimer();
      return;
    }

    if (wantsOnlineRef.current) {
      scheduleOfflineAfterDisconnect();
    }

    return clearDisconnectTimer;
  }, [isConnected, isTrainer]);

  useEffect(() => {
    if (!isTrainer) return;

    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      if (next === "active") {
        clearDisconnectTimer();
        return;
      }

      /** Background: keep online; socket heartbeat continues when OS allows. */
      if (next === "background" && prev === "active") {
        clearDisconnectTimer();
      }
    });

    return () => sub.remove();
  }, [isTrainer]);

  useEffect(() => {
    if (status !== "signedOut") return;
    clearDisconnectTimer();
    if (wantsOnlineRef.current) {
      void (async () => {
        try {
          await setOnlineAvailability(false);
        } catch {
          /* best effort */
        }
      })();
    }
    wantsOnlineRef.current = false;
  }, [status]);

  return null;
}
