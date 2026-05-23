import type { PendingAuthAction } from "../types/authIntent";

let pending: PendingAuthAction | null = null;

export function setPendingAuthIntent(action: PendingAuthAction | null): void {
  pending = action;
}

export function peekPendingAuthIntent(): PendingAuthAction | null {
  return pending;
}

export function consumePendingAuthIntent(): PendingAuthAction | null {
  const current = pending;
  pending = null;
  return current;
}
