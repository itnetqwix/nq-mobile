/** Bumped when a new session is established — in-flight hydrate must not clobber it. */
let authEpoch = 0;

/** After login/hydrate, suppress global 401 sign-out briefly while queries settle. */
let authGraceUntilMs = 0;

const AUTH_GRACE_MS = 20_000;

export function getAuthEpoch(): number {
  return authEpoch;
}

export function bumpAuthEpoch(): number {
  authEpoch += 1;
  return authEpoch;
}

export function markAuthSessionEstablished(): void {
  bumpAuthEpoch();
  authGraceUntilMs = Date.now() + AUTH_GRACE_MS;
}

export function isInAuthGracePeriod(): boolean {
  return Date.now() < authGraceUntilMs;
}
