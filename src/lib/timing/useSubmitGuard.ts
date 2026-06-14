import { useCallback, useRef, useState } from "react";
import { SUBMIT_GUARD_MS } from "./constants";

type GuardOptions = {
  /** Cooldown after a successful run (default SUBMIT_GUARD_MS). */
  cooldownMs?: number;
};

/**
 * Prevents double-tap / duplicate async submits while a handler is in flight.
 */
export function useSubmitGuard(options: GuardOptions = {}) {
  const { cooldownMs = SUBMIT_GUARD_MS } = options;
  const [submitting, setSubmitting] = useState(false);
  const busyRef = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const guard = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      if (busyRef.current) return undefined;
      busyRef.current = true;
      setSubmitting(true);
      try {
        return await fn();
      } finally {
        busyRef.current = false;
        setSubmitting(false);
        if (cooldownRef.current) clearTimeout(cooldownRef.current);
        cooldownRef.current = setTimeout(() => {
          cooldownRef.current = null;
        }, cooldownMs);
      }
    },
    [cooldownMs]
  );

  return { submitting, guard, isBusy: submitting || busyRef.current };
}
