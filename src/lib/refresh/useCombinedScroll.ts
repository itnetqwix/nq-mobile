import { useCallback, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

/** Chain multiple scroll handlers (e.g. morph refresh + tab bar hide). */
export function useCombinedScroll(
  ...handlers: Array<((e: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined>
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  return useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    for (const handler of handlersRef.current) {
      handler?.(e);
    }
  }, []);
}
