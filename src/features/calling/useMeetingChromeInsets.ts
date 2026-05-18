import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Heights reserved for bottom chrome so PIPs stay draggable above controls. */
export const ACTION_BAR_HEIGHT = 72;
export const CLIP_TIMELINE_HEIGHT = 88;

/** Shared safe-area offsets for in-call floating chrome (notch, Dynamic Island, home bar). */
export function useMeetingChromeInsets() {
  const insets = useSafeAreaInsets();
  const bottomChrome = insets.bottom + 16;
  const pipSafeBottom = bottomChrome + ACTION_BAR_HEIGHT + CLIP_TIMELINE_HEIGHT;

  return {
    insets,
    topChrome: insets.top + 8,
    bottomChrome,
    clipControlsBottom: insets.bottom + ACTION_BAR_HEIGHT + 12,
    pipSafeBottom,
    mainPaneTop: insets.top + 56,
  };
}
