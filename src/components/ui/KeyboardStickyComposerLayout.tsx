import React from "react";
import {
  KeyboardAvoidingView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { keyboardAvoidingBehavior } from "../../lib/keyboard/keyboardLayout";
import { space } from "../../theme";

type Props = {
  /** Main scrollable/list region. */
  children: React.ReactNode;
  /** Composer, send bar, or CTA pinned above the keyboard. */
  composer: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
};

/**
 * Chat / support layout: list fills the screen; composer stays above the keyboard.
 */
export function KeyboardStickyComposerLayout({
  children,
  composer,
  style,
  keyboardVerticalOffset = 0,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={keyboardAvoidingBehavior()}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <View style={styles.flex}>{children}</View>
      <View style={{ paddingBottom: Math.max(insets.bottom, space.xs) }}>{composer}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
