/** Result of biometric unlock attempted during the cold-start splash (if any). */
let attempted = false;
let succeeded: boolean | null = null;

export function markColdStartUnlockResult(ok: boolean): void {
  attempted = true;
  succeeded = ok;
}

export function getColdStartUnlockSnapshot(): { attempted: boolean; succeeded: boolean | null } {
  return { attempted, succeeded };
}

export function resetColdStartUnlockState(): void {
  attempted = false;
  succeeded = null;
}
