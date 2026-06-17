import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Heights reserved for bottom chrome so video never sits under controls. */
export const ACTION_BAR_HEIGHT = 44;
export const CLIP_TIMELINE_HEIGHT = 52;
export const TOP_CHROME_HEIGHT = 44;
/** Height of the DualVideoStrip shown below clips in clip mode. */
export const DUAL_VIDEO_STRIP_HEIGHT = 102;
/** Default single-row annotation toolbar height before onLayout measurement. */
export const ANNOTATION_TOOLBAR_HEIGHT = 52;

/** Shared safe-area offsets for in-call floating chrome (notch, Dynamic Island, home bar). */
export function useMeetingChromeInsets(options?: {
  inClipMode?: boolean;
  /** Timeline is docked inside the clip frame (not floating) — reclaim bottom gap. */
  inlineClipControls?: boolean;
  /** Trainer annotation toolbar is visible — reserve measured height above action bar. */
  annotationToolbarOpen?: boolean;
  annotationToolbarHeight?: number;
  /** Measured ActionButtons row height (trainer row may wrap). */
  actionBarHeight?: number;
  /** Dual inline clip timelines — reserve extra space when annotation toolbar is open. */
  dualInlineClipControls?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const inClipMode = options?.inClipMode ?? false;
  const inlineClipControls = options?.inlineClipControls ?? false;
  const actionBarHeight = options?.actionBarHeight ?? ACTION_BAR_HEIGHT;
  const annotationToolbarOpen = options?.annotationToolbarOpen ?? false;
  const annotationToolbarHeight =
    options?.annotationToolbarHeight ?? ANNOTATION_TOOLBAR_HEIGHT;
  const dualInlineClipControls = options?.dualInlineClipControls ?? false;

  const bottomChrome = insets.bottom + 8;
  const actionReserve = actionBarHeight + 10;
  /** Reserve timeline height for floating PIPs even when controls are inline in the clip frame. */
  const clipTimelineReserve = inClipMode ? CLIP_TIMELINE_HEIGHT + 8 : 0;
  const floatingClipReserve = inClipMode && !inlineClipControls ? clipTimelineReserve : 0;
  /** Corner PIPs overlay the clip stage — no extra main-pane bottom reserve. */
  const videoStripReserve = 0;
  const annotationReserve = annotationToolbarOpen
    ? annotationToolbarHeight +
      8 +
      (dualInlineClipControls ? CLIP_TIMELINE_HEIGHT + 6 : 0)
    : 0;
  const bottomStackReserve = annotationReserve;

  const pipSafeBottom =
    bottomChrome +
    actionReserve +
    bottomStackReserve +
    (inlineClipControls ? 0 : clipTimelineReserve);
  /** Collapsed "Show cameras" sits on the action bar row, below inline clip controls. */
  const cameraStripCollapsedBottom = bottomChrome + 6;
  /** Main pane bottom padding accounts for action bar + annotation stack + video strip in clip mode. */
  const mainPaneBottomInClip =
    bottomChrome +
    actionReserve +
    bottomStackReserve +
    floatingClipReserve +
    videoStripReserve;

  return {
    insets,
    topChrome: insets.top + 6,
    bottomChrome,
    clipControlsBottom: bottomChrome + actionReserve + floatingClipReserve + 6,
    pipSafeBottom,
    cameraStripCollapsedBottom,
    mainPaneTop: insets.top + TOP_CHROME_HEIGHT,
    mainPaneBottom: inClipMode ? mainPaneBottomInClip : pipSafeBottom,
    /** Dock annotation toolbar directly above the measured action bar. */
    annotationToolbarBottom: bottomChrome + actionReserve + 4,
    bottomStackReserve,
    actionReserve,
  };
}
