import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PendingAuthAction } from "../types/authIntent";

/**
 * Stores the action the user was trying to take when they were redirected
 * to the auth modal so we can resume it after they sign in / sign up.
 *
 * We keep a synchronous in-memory copy (so consumers like
 * `PendingAuthResumeBridge` don't need to be async) and mirror writes into
 * AsyncStorage so the intent survives app restarts during the OTP flow.
 */

const STORAGE_KEY = "nq.pendingAuthIntent";
const MAX_AGE_MS = 1000 * 60 * 60 * 24;

let pending: PendingAuthAction | null = null;
let hydrated = false;

export function setPendingAuthIntent(action: PendingAuthAction | null): void {
  pending = action ? { ...action, t: action.t ?? Date.now() } : null;
  void (async () => {
    try {
      if (pending) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* best effort */
    }
  })();
}

export function peekPendingAuthIntent(): PendingAuthAction | null {
  return pending;
}

export function consumePendingAuthIntent(): PendingAuthAction | null {
  const current = pending;
  pending = null;
  void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  return current;
}

/**
 * Load any persisted intent into memory. Call once at app boot before the
 * `PendingAuthResumeBridge` mounts. Old or malformed values are dropped.
 */
export async function hydratePendingAuthIntent(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PendingAuthAction;
    if (!parsed || typeof parsed !== "object") return;
    if (parsed.t && Date.now() - parsed.t > MAX_AGE_MS) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    pending = parsed;
  } catch {
    /* ignore — fresh start is fine */
  }
}
