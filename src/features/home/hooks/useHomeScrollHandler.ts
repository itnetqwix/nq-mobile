import { useCallback } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useTabBarScrollContextOptional } from "../../../navigation/TabBarScrollContext";

/** Reports vertical scroll to hide/show the floating tab bar (Blinkit-style). */
export function useHomeScrollHandler() {
  const tabBar = useTabBarScrollContextOptional();

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      tabBar?.reportScroll(e.nativeEvent.contentOffset.y);
    },
    [tabBar]
  );

  return {
    onScroll,
    scrollEventThrottle: 16 as const,
  };
}
