/**
 * Trainer online presence vs app lifecycle:
 * - Stay online while the app is in the background for up to 15 minutes.
 * - Mark offline only after the grace window expires without reopening the app.
 * - Socket disconnect in the foreground still uses the same grace window.
 * - Mark offline immediately on sign-out.
 */

import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "../auth/context/AuthContext";
import { AccountType } from "../../constants/accountType";
import { setOnlineAvailability } from "../home/api/homeApi";
import { resolveShowAsOnline } from "../../lib/user/resolveShowAsOnline";
import { useSocket } from "../socket/SocketContext";

/** Trainers must reopen the app within this window to stay visible for instant booking. */
export const TRAINER_ONLINE_GRACE_MS = 15 * 60 * 1000;

export function TrainerOnlinePresenceBridge() {
  const { status, accountType, user, patchUser } = useAuth();
  const { isConnected } = useSocket();
  const wantsOnlineRef = useRef(false);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const isTrainer = accountType === AccountType.TRAINER && status === "signedIn";

  useEffect(() => {
    wantsOnlineRef.current = isTrainer && resolveShowAsOnline(user);
  }, [isTrainer, user]);

  const clearGraceTimer = () => {
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  };

  const markOffline = () => {
    if (!wantsOnlineRef.current) return;
    void (async () => {
      try {
        await setOnlineAvailability(false);
        patchUser({ showAsOnline: false });
      } catch {
        /* best effort */
      }
    })();
  };

  const scheduleOfflineAfterGrace = () => {
    if (!wantsOnlineRef.current) return;
    clearGraceTimer();
    graceTimerRef.current = setTimeout(() => {
      graceTimerRef.current = null;
      markOffline();
    }, TRAINER_ONLINE_GRACE_MS);
  };

  useEffect(() => {
    if (!isTrainer) {
      clearGraceTimer();
      return;
    }

    if (isConnected) {
      if (appStateRef.current === "active") {
        clearGraceTimer();
      }
      return;
    }

    if (wantsOnlineRef.current) {
      scheduleOfflineAfterGrace();
    }

    return clearGraceTimer;
  }, [isConnected, isTrainer]);

  useEffect(() => {
    if (!isTrainer) return;

    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      if (next === "active") {
        clearGraceTimer();
        return;
      }

      /** Background / inactive: keep online during the 15-minute grace window. */
      if (
        wantsOnlineRef.current &&
        (next === "background" || next === "inactive") &&
        prev === "active"
      ) {
        scheduleOfflineAfterGrace();
      }
    });

    return () => sub.remove();
  }, [isTrainer]);

  useEffect(() => {
    if (status !== "signedOut") return;
    clearGraceTimer();
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
