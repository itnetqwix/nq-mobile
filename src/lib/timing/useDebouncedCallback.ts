import { useEffect, useMemo, useRef } from "react";
import { debounce, type DebouncedFn } from "./debounce";

export function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delayMs: number
): DebouncedFn<T> {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debounced = useMemo(
    () =>
      debounce((...args: Parameters<T>) => {
        callbackRef.current(...args);
      }, delayMs),
    [delayMs]
  );

  useEffect(() => () => debounced.cancel(), [debounced]);

  return debounced as DebouncedFn<T>;
}
