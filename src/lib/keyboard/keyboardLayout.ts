import { Platform } from "react-native";
import { space } from "../../theme";

/** iOS needs KAV; Android uses `softwareKeyboardLayoutMode: resize` in app.json. */
export function keyboardAvoidingBehavior(): "padding" | undefined {
  return Platform.OS === "ios" ? "padding" : undefined;
}

export type ScrollKeyboardPaddingOptions = {
  keyboardOpen: boolean;
  keyboardHeight: number;
  safeBottom: number;
  /** Bottom padding when keyboard is closed (tab bar + base pad). */
  closedBottomPad: number;
  /** Height reserved for a pinned footer sibling outside the scroll view. */
  footerSlot?: number;
};

/**
 * Bottom padding for scroll content. Avoids double-counting keyboard height on
 * Android (window already resizes) while keeping iOS forms scrollable.
 */
export function computeScrollKeyboardPadding({
  keyboardOpen,
  keyboardHeight,
  safeBottom,
  closedBottomPad,
  footerSlot = 0,
}: ScrollKeyboardPaddingOptions): number {
  if (!keyboardOpen) {
    return closedBottomPad + footerSlot;
  }
  if (Platform.OS === "android") {
    return space.md + footerSlot + safeBottom;
  }
  return space.md + footerSlot + Math.max(safeBottom, space.sm);
}

/** Extra inset for multiline inputs sitting at the bottom of long forms. */
export function keyboardScrollExtraInset(keyboardOpen: boolean, keyboardHeight: number): number {
  if (!keyboardOpen) return 0;
  if (Platform.OS === "android") return Math.min(keyboardHeight * 0.15, 48);
  return 0;
}
