import { useSyncExternalStore } from "react";

export type DeferredBookResume = {
  trainer: Record<string, unknown>;
  mode: "instant" | "schedule";
};

let deferred: DeferredBookResume | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): DeferredBookResume | null {
  return deferred;
}

export function setDeferredBookResume(value: DeferredBookResume | null): void {
  deferred = value;
  emit();
}

export function peekDeferredBookResume(): DeferredBookResume | null {
  return deferred;
}

export function clearDeferredBookResume(): void {
  if (!deferred) return;
  deferred = null;
  emit();
}

export function useDeferredBookResume(): DeferredBookResume | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
