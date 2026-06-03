import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Heights reserved for bottom chrome so video never sits under controls. */
export const ACTION_BAR_HEIGHT = 44;
export const CLIP_TIMELINE_HEIGHT = 52;
export const TOP_CHROME_HEIGHT = 44;

/** Shared safe-area offsets for in-call floating chrome (notch, Dynamic Island, home bar). */
export function useMeetingChromeInsets(options?: {
  inClipMode?: boolean;
  /** Timeline is docked inside the clip frame (not floating) — reclaim bottom gap. */
  inlineClipControls?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const inClipMode = options?.inClipMode ?? false;
  const inlineClipControls = options?.inlineClipControls ?? false;
  const bottomChrome = insets.bottom + 8;
  const actionReserve = ACTION_BAR_HEIGHT + 10;
  const clipReserve =
    inClipMode && !inlineClipControls ? CLIP_TIMELINE_HEIGHT + 8 : 0;
  const pipSafeBottom = bottomChrome + actionReserve + clipReserve;

  return {
    insets,
    topChrome: insets.top + 6,
    bottomChrome,
    clipControlsBottom: bottomChrome + actionReserve + 6,
    pipSafeBottom,
    mainPaneTop: insets.top + TOP_CHROME_HEIGHT,
    mainPaneBottom: pipSafeBottom,
  };
}
