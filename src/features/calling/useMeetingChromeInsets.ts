import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Shared safe-area offsets for in-call floating chrome (notch, Dynamic Island, home bar). */
export function useMeetingChromeInsets() {
  const insets = useSafeAreaInsets();
  return {
    insets,
    topChrome: insets.top + 8,
    bottomChrome: insets.bottom + 16,
    clipControlsBottom: insets.bottom + 88,
    mainPaneTop: insets.top + 56,
  };
}
