import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@netqwix:call.lastInterruptedSession";
const STALE_AFTER_MS = 10 * 60 * 1000;

export type LastInterruptedSession = {
  lessonId: string;
  partnerName?: string;
  endedReason?: "drop" | "network" | "unknown";
  endedAt: number;
};

let state: LastInterruptedSession | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const cb of listeners) cb();
}

/**
 * Tiny in-memory + AsyncStorage store for the "your call just dropped"
 * banner. We persist so a fresh app launch can still surface the rejoin
 * banner if the drop happened seconds earlier (e.g. crash, OS kill).
 *
 * Stored values are evicted automatically after 10 minutes — beyond
 * that, a rejoin would be too stale to feel relevant.
 */
export async function bootstrapCallRejoinStore() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as LastInterruptedSession | null;
    if (
      parsed &&
      typeof parsed.lessonId === "string" &&
      Date.now() - (parsed.endedAt ?? 0) < STALE_AFTER_MS
    ) {
      state = parsed;
      notify();
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* noop */
  }
}

export function setLastInterruptedSession(
  value: LastInterruptedSession | null
) {
  state = value;
  if (value) {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value)).catch(() => {});
  } else {
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }
  notify();
}

export function getLastInterruptedSession(): LastInterruptedSession | null {
  if (!state) return null;
  if (Date.now() - state.endedAt > STALE_AFTER_MS) {
    state = null;
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    return null;
  }
  return state;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return state;
}

export function useLastInterruptedSession(): LastInterruptedSession | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
