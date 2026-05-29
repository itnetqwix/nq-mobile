/**
 * Tracks the active native lesson call so global handlers (e.g. auth revoke)
 * can end the call gracefully before signing out.
 */

type ActiveCall = {
  sessionId: string;
  onForceEnd?: () => void;
};

let active: ActiveCall | null = null;

export function registerActiveCall(call: ActiveCall): void {
  active = call;
}

export function unregisterActiveCall(sessionId?: string): void {
  if (!sessionId || active?.sessionId === sessionId) {
    active = null;
  }
}

export function getActiveCall(): ActiveCall | null {
  return active;
}

export function isInActiveCall(): boolean {
  return active != null;
}
