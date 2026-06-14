import { useEffect, useMemo, useRef } from "react";
import { throttle, type ThrottledFn } from "./debounce";

export function useThrottledCallback<T extends (...args: never[]) => void>(
  callback: T,
  waitMs: number,
  opts?: { leading?: boolean; trailing?: boolean }
): ThrottledFn<T> {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const throttled = useMemo(
    () =>
      throttle((...args: Parameters<T>) => {
        callbackRef.current(...args);
      }, waitMs, opts),
    [waitMs, opts?.leading, opts?.trailing]
  );

  useEffect(() => () => throttled.cancel(), [throttled]);

  return throttled as ThrottledFn<T>;
}
