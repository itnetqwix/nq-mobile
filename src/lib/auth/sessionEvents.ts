type UnauthorizedListener = () => void;

const listeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitUnauthorized() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

/** Fired when API returns 401 — show session expired UI before sign-out. */
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener) {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export function emitSessionExpired() {
  for (const l of sessionExpiredListeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}
