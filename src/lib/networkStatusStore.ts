/**
 * Lightweight network-online store.
 *
 * We don't ship NetInfo as a dependency — instead the store reacts to
 * Axios interceptor signals (`reportNetworkOk` / `reportNetworkError`)
 * and to a low-rate health ping that runs while we believe the network
 * is offline.
 *
 * The store is `useSyncExternalStore`-friendly via `useNetworkOnline`.
 */

import { useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();
let online = true;
/** When we believe we're offline this is the last failure timestamp. */
let lastOfflineAt: number | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function snapshot(): boolean {
  return online;
}

export function isNetworkOnline(): boolean {
  return online;
}

export function useNetworkOnline(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Called from the axios response interceptor whenever a request fails
 * with a "network error" (no HTTP status). Flipping online → offline
 * starts the periodic ping so we'll auto-recover the moment the
 * connection comes back.
 */
export function reportNetworkError(): void {
  if (!online) return;
  online = false;
  lastOfflineAt = Date.now();
  startPingLoop();
  emit();
}

/** Called from the axios success interceptor on any non-network response. */
export function reportNetworkOk(): void {
  if (online) return;
  online = true;
  stopPingLoop();
  emit();
}

export function getLastOfflineAt(): number | null {
  return lastOfflineAt;
}

function startPingLoop() {
  if (pingTimer) return;
  pingTimer = setInterval(probe, 15_000);
}

function stopPingLoop() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

/**
 * Cheap connectivity probe. We don't care about the response body —
 * any reachable HTTP response (even 4xx) means the radio is back up.
 */
async function probe() {
  try {
    const url = process.env.EXPO_PUBLIC_NETWORK_PROBE_URL || "https://www.gstatic.com/generate_204";
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { method: "GET", signal: ctrl.signal });
    clearTimeout(timeout);
    if (res) reportNetworkOk();
  } catch {
    /* still offline */
  }
}
