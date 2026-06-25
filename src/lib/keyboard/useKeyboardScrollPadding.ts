import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { computeScrollKeyboardPadding, keyboardScrollExtraInset } from "./keyboardLayout";
import { useKeyboardSheetInsets } from "./useKeyboardSheetInsets";

/** Bottom padding for ScrollView content that should clear the keyboard and safe area. */
export function useKeyboardScrollPadding(closedBottomPad: number, footerSlot = 0) {
  const insets = useSafeAreaInsets();
  const { keyboardOpen, keyboardHeight } = useKeyboardSheetInsets();

  return useMemo(
    () =>
      computeScrollKeyboardPadding({
        keyboardOpen,
        keyboardHeight,
        safeBottom: insets.bottom,
        closedBottomPad,
        footerSlot,
      }) + keyboardScrollExtraInset(keyboardOpen, keyboardHeight),
    [closedBottomPad, footerSlot, insets.bottom, keyboardHeight, keyboardOpen]
  );
}
