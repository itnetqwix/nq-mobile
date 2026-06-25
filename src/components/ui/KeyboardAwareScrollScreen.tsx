import React, { useMemo } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  computeScrollKeyboardPadding,
  keyboardAvoidingBehavior,
  keyboardScrollExtraInset,
  useKeyboardSheetInsets,
} from "../../lib/keyboard";
import { useFloatingTabBarBottomInset } from "../../navigation/useFloatingTabBarBottomInset";
import { space } from "../../theme";

type Props = {
  children: React.ReactNode;
  /** Pinned footer (CTA) — stays above keyboard as a KAV sibling. */
  footer?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  dismissKeyboardOnTap?: boolean;
  /** Extra bottom padding when keyboard is closed (default: tab bar clearance). */
  closedBottomInset?: number;
  keyboardVerticalOffset?: number;
} & Pick<ScrollViewProps, "keyboardShouldPersistTaps" | "showsVerticalScrollIndicator">;

/**
 * Standard keyboard-safe full-screen scroll: header/content in ScrollView,
 * optional fixed footer, tab-bar padding when keyboard is closed.
 */
export function KeyboardAwareScrollScreen({
  children,
  footer,
  contentContainerStyle,
  style,
  dismissKeyboardOnTap = false,
  closedBottomInset,
  keyboardVerticalOffset = 0,
  keyboardShouldPersistTaps = "handled",
  showsVerticalScrollIndicator = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const { keyboardOpen, keyboardHeight } = useKeyboardSheetInsets();
  const tabBarPad = useFloatingTabBarBottomInset(space.sm);
  const closedPad = closedBottomInset ?? tabBarPad;
  const footerSlot = footer ? 88 : 0;

  const scrollBottomPad = useMemo(
    () =>
      computeScrollKeyboardPadding({
        keyboardOpen,
        keyboardHeight,
        safeBottom: insets.bottom,
        closedBottomPad: closedPad,
        footerSlot,
      }) + keyboardScrollExtraInset(keyboardOpen, keyboardHeight),
    [closedPad, footerSlot, insets.bottom, keyboardHeight, keyboardOpen]
  );

  const scroll = (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }, contentContainerStyle]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
    >
      {children}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={keyboardAvoidingBehavior()}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {dismissKeyboardOnTap ? (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          {scroll}
        </TouchableWithoutFeedback>
      ) : (
        scroll
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 0,
    paddingTop: space.md,
  },
  footer: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
});
