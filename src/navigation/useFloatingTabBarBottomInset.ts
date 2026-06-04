import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { floatingTabBarBottomInset } from "./FloatingTabBar";

/** Bottom padding so scroll content clears the floating tab bar pill. */
export function useFloatingTabBarBottomInset(extra = 0): number {
  const insets = useSafeAreaInsets();
  return useMemo(
    () => floatingTabBarBottomInset(insets.bottom) + extra,
    [insets.bottom, extra]
  );
}
