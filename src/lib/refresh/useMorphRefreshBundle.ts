import { useMorphRefresh } from "./useMorphRefresh";

export type MorphRefreshBundle = {
  refreshing: boolean;
  headerProps: {
    pullValue: import("react-native").Animated.Value;
    released: boolean;
    refreshing: boolean;
  };
  onMorphScroll: (e: import("react-native").NativeSyntheticEvent<import("react-native").NativeScrollEvent>) => void;
  scrollEventThrottle: number;
  onRefreshControl: () => void;
};

/**
 * Single bundle for morph header + scroll offset + RefreshControl wiring.
 * Pass `externalRefreshing` when React Query (or similar) also drives the spinner.
 */
export function useMorphRefreshBundle(
  onRefresh: () => void | Promise<unknown>,
  externalRefreshing = false
): MorphRefreshBundle {
  const morph = useMorphRefresh({
    onRefresh: async () => {
      await Promise.resolve(onRefresh());
    },
  });
  const refreshing = morph.refreshing || externalRefreshing;
  return {
    refreshing,
    headerProps: {
      ...morph.headerProps,
      refreshing,
    },
    onMorphScroll: morph.scrollProps.onScroll,
    scrollEventThrottle: morph.scrollProps.scrollEventThrottle,
    onRefreshControl: morph.onRefreshControl,
  };
}
