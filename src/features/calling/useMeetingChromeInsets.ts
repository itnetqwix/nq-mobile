import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Heights reserved for bottom chrome so video never sits under controls. */
export const ACTION_BAR_HEIGHT = 44;
export const CLIP_TIMELINE_HEIGHT = 52;
export const TOP_CHROME_HEIGHT = 44;
/** Height of the DualVideoStrip shown below clips in clip mode. */
export const DUAL_VIDEO_STRIP_HEIGHT = 102;

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
  /** Reserve timeline height for floating PIPs even when controls are inline in the clip frame. */
  const clipTimelineReserve = inClipMode ? CLIP_TIMELINE_HEIGHT + 8 : 0;
  const floatingClipReserve = inClipMode && !inlineClipControls ? clipTimelineReserve : 0;
  /** Corner PIPs overlay the clip stage — no extra main-pane bottom reserve. */
  const videoStripReserve = 0;
  const pipSafeBottom =
    bottomChrome + actionReserve + (inlineClipControls ? 0 : clipTimelineReserve);
  /** Collapsed "Show cameras" sits on the action bar row, below inline clip controls. */
  const cameraStripCollapsedBottom = bottomChrome + 6;
  /** Main pane bottom padding accounts for action bar + video strip in clip mode. */
  const mainPaneBottomInClip =
    bottomChrome + actionReserve + floatingClipReserve + videoStripReserve;

  return {
    insets,
    topChrome: insets.top + 6,
    bottomChrome,
    clipControlsBottom: bottomChrome + actionReserve + floatingClipReserve + 6,
    pipSafeBottom,
    cameraStripCollapsedBottom,
    mainPaneTop: insets.top + TOP_CHROME_HEIGHT,
    mainPaneBottom: inClipMode ? mainPaneBottomInClip : pipSafeBottom,
  };
}
