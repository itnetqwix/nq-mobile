import React, { createContext, useCallback, useContext, useMemo } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const HIDE_OFFSET = 120;
const SCROLL_DELTA_THRESHOLD = 8;
const MIN_SCROLL_Y_TO_HIDE = 64;

type TabBarScrollContextValue = {
  translateY: SharedValue<number>;
  reportScroll: (y: number) => void;
  setVisible: (visible: boolean) => void;
};

const TabBarScrollContext = createContext<TabBarScrollContextValue | null>(null);

export function TabBarScrollProvider({ children }: { children: React.ReactNode }) {
  const translateY = useSharedValue(0);
  const lastY = useSharedValue(0);

  const setVisible = useCallback(
    (visible: boolean) => {
      translateY.value = withTiming(visible ? 0 : HIDE_OFFSET, { duration: 220 });
    },
    [translateY]
  );

  const reportScroll = useCallback(
    (y: number) => {
      const prev = lastY.value;
      const delta = y - prev;
      lastY.value = y;

      if (y <= MIN_SCROLL_Y_TO_HIDE) {
        if (translateY.value !== 0) {
          translateY.value = withTiming(0, { duration: 220 });
        }
        return;
      }

      if (delta > SCROLL_DELTA_THRESHOLD) {
        if (translateY.value !== HIDE_OFFSET) {
          translateY.value = withTiming(HIDE_OFFSET, { duration: 220 });
        }
      } else if (delta < -SCROLL_DELTA_THRESHOLD) {
        if (translateY.value !== 0) {
          translateY.value = withTiming(0, { duration: 220 });
        }
      }
    },
    [lastY, translateY]
  );

  const value = useMemo(
    () => ({ translateY, reportScroll, setVisible }),
    [translateY, reportScroll, setVisible]
  );

  return (
    <TabBarScrollContext.Provider value={value}>{children}</TabBarScrollContext.Provider>
  );
}

export function useTabBarScrollContext(): TabBarScrollContextValue {
  const ctx = useContext(TabBarScrollContext);
  if (!ctx) {
    throw new Error("useTabBarScrollContext must be used within TabBarScrollProvider");
  }
  return ctx;
}

/** Optional — returns no-op handlers when provider is absent (e.g. tests). */
export function useTabBarScrollContextOptional(): TabBarScrollContextValue | null {
  return useContext(TabBarScrollContext);
}

export function useTabBarAnimatedOffset() {
  const ctx = useTabBarScrollContextOptional();
  const translateY = ctx?.translateY ?? null;

  return useAnimatedStyle(() => ({
    transform: [{ translateY: translateY ? translateY.value : 0 }],
  }));
}
