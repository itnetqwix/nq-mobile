import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Heights reserved for bottom chrome so PIPs can overlap the bar when dragged. */
export const ACTION_BAR_HEIGHT = 52;
export const CLIP_TIMELINE_HEIGHT = 72;

/** Shared safe-area offsets for in-call floating chrome (notch, Dynamic Island, home bar). */
export function useMeetingChromeInsets() {
  const insets = useSafeAreaInsets();
  const bottomChrome = insets.bottom + 16;
  const pipSafeBottom = bottomChrome + 24;

  return {
    insets,
    topChrome: insets.top + 8,
    bottomChrome,
    clipControlsBottom: insets.bottom + ACTION_BAR_HEIGHT + 12,
    pipSafeBottom,
    mainPaneTop: insets.top + 56,
  };
}
