/**
 * Trainer online presence vs app lifecycle:
 * - Background (home button): server grace keeps trainer visible up to 15 minutes.
 * - Force-kill from app switcher: socket drops with no grace → offline immediately.
 * - Reopen within 15 min: clears grace and restores live presence via socket.
 */

import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "../auth/context/AuthContext";
import { AccountType } from "../../constants/accountType";
import {
  clearOnlineBackgroundGrace,
  setOnlineAvailability,
  setOnlineBackgroundGrace,
} from "../home/api/homeApi";
import { resolveShowAsOnline } from "../../lib/user/resolveShowAsOnline";

/** Trainers must reopen the app within this window to stay visible for instant booking. */
export const TRAINER_ONLINE_GRACE_MS = 15 * 60 * 1000;

export function TrainerOnlinePresenceBridge() {
  const { status, accountType, user, patchUser } = useAuth();
  const wantsOnlineRef = useRef(false);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const graceSyncRef = useRef(false);

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

  const syncBackgroundGrace = async () => {
    if (!wantsOnlineRef.current || graceSyncRef.current) return;
    graceSyncRef.current = true;
    try {
      await setOnlineBackgroundGrace(15);
      scheduleOfflineAfterGrace();
    } catch {
      scheduleOfflineAfterGrace();
    } finally {
      graceSyncRef.current = false;
    }
  };

  const syncForegroundGrace = async () => {
    clearGraceTimer();
    try {
      await clearOnlineBackgroundGrace();
    } catch {
      /* non-blocking */
    }
  };

  useEffect(() => {
    if (!isTrainer) {
      clearGraceTimer();
      return;
    }

    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      if (next === "active") {
        void syncForegroundGrace();
        return;
      }

      if (
        wantsOnlineRef.current &&
        (next === "background" || next === "inactive") &&
        prev === "active"
      ) {
        void syncBackgroundGrace();
      }
    });

    return () => sub.remove();
  }, [isTrainer]);

  useEffect(() => {
    if (status !== "signedOut") return;
    clearGraceTimer();
    void clearOnlineBackgroundGrace().catch(() => undefined);
    if (wantsOnlineRef.current) {
      void setOnlineAvailability(false).catch(() => undefined);
    }
    wantsOnlineRef.current = false;
  }, [status]);

  return null;
}
