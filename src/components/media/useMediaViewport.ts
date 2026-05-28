import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Options = {
  /** Space reserved above media (header + optional hint). */
  headerHeight?: number;
  /** Space reserved below media (footer hint). */
  footerHeight?: number;
};

/**
 * Responsive media area that respects safe areas and orientation changes.
 */
export function useMediaViewport(opts?: Options) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const header = opts?.headerHeight ?? 0;
  const footer = opts?.footerHeight ?? 0;

  const contentWidth = width;
  const contentHeight = useMemo(
    () => Math.max(120, height - insets.top - insets.bottom - header - footer),
    [height, insets.top, insets.bottom, header, footer]
  );

  return {
    width: contentWidth,
    height: contentHeight,
    insets,
    screenWidth: width,
    screenHeight: height,
  };
}
