/**
 * `useInlineSaved` — manages transient "Saved ✓" badges for in-place
 * settings rows.
 *
 *   const saved = useInlineSaved();
 *   const onToggle = async (v) => {
 *     try {
 *       await updateThing(v);
 *       saved.ping("thing");
 *     } catch {
 *       saved.fail("thing");
 *     }
 *   };
 *
 *   <InlineSavedIndicator visible={saved.is("thing")} tone={saved.tone("thing")} />
 *
 * Each `ping(key)` flips the indicator on for `clearAfterMs` ms (default
 * 1800) then auto-clears. Calling `ping` again resets the timer so rapid
 * toggling still feels responsive.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type ToneMap = Record<string, "success" | "error">;
type TimerMap = Record<string, ReturnType<typeof setTimeout> | undefined>;

export type UseInlineSavedOptions = {
  /** Auto-clear duration in ms (default 1800). */
  clearAfterMs?: number;
};

export type UseInlineSavedResult = {
  is: (key: string) => boolean;
  tone: (key: string) => "success" | "error";
  ping: (key: string) => void;
  fail: (key: string) => void;
  clear: (key: string) => void;
  clearAll: () => void;
};

export function useInlineSaved(options: UseInlineSavedOptions = {}): UseInlineSavedResult {
  const { clearAfterMs = 1800 } = options;
  const [tones, setTones] = useState<ToneMap>({});
  const timersRef = useRef<TimerMap>({});

  useEffect(() => () => {
    /** Cleanup on unmount — clear every outstanding auto-hide. */
    for (const key of Object.keys(timersRef.current)) {
      const t = timersRef.current[key];
      if (t) clearTimeout(t);
    }
    timersRef.current = {};
  }, []);

  const schedule = useCallback(
    (key: string, tone: "success" | "error") => {
      setTones((prev) => ({ ...prev, [key]: tone }));
      const existing = timersRef.current[key];
      if (existing) clearTimeout(existing);
      timersRef.current[key] = setTimeout(() => {
        setTones((prev) => {
          if (!(key in prev)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
        delete timersRef.current[key];
      }, clearAfterMs);
    },
    [clearAfterMs]
  );

  const ping = useCallback((key: string) => schedule(key, "success"), [schedule]);
  const fail = useCallback((key: string) => schedule(key, "error"), [schedule]);

  const clear = useCallback((key: string) => {
    const t = timersRef.current[key];
    if (t) clearTimeout(t);
    delete timersRef.current[key];
    setTones((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    for (const key of Object.keys(timersRef.current)) {
      const t = timersRef.current[key];
      if (t) clearTimeout(t);
    }
    timersRef.current = {};
    setTones({});
  }, []);

  const is = useCallback((key: string) => !!tones[key], [tones]);
  const tone = useCallback(
    (key: string): "success" | "error" => tones[key] ?? "success",
    [tones]
  );

  return { is, tone, ping, fail, clear, clearAll };
}
