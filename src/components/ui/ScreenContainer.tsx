import React from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "../../theme";

export type ScreenContainerProps = {
  /** Render mode — scroll wraps a `ScrollView`, plain skips it for flex
   *  screens (e.g. lists managing their own scroll). */
  scroll?: boolean;
  /** Apply safe-area insets (top + bottom) — true by default. Pass `false`
   *  when the screen sits below a navigation header that already owns the
   *  top inset. */
  applyTopInset?: boolean;
  applyBottomInset?: boolean;
  padding?: keyof typeof space | 0;
  /** Pull-to-refresh handler — only meaningful when `scroll` is true. */
  refreshing?: boolean;
  onRefresh?: () => void;
  background?: string;
  dismissKeyboardOnTap?: boolean;
  contentStyle?: ViewStyle;
  style?: ViewStyle;
  children?: React.ReactNode;
};

/**
 * Consistent screen wrapper: safe-area insets, padding, keyboard-aware
 * behaviour, and optional scroll + pull-to-refresh. Every refactored screen
 * should mount here so we share the same chrome dimensions everywhere.
 */
export function ScreenContainer({
  scroll = true,
  applyTopInset = false,
  applyBottomInset = true,
  padding = "md",
  refreshing,
  onRefresh,
  background,
  dismissKeyboardOnTap,
  contentStyle,
  style,
  children,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  const padValue = padding === 0 ? 0 : space[padding];

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: background ?? colors.surface,
    paddingTop: applyTopInset ? insets.top : 0,
    paddingBottom: applyBottomInset ? insets.bottom : 0,
  };

  const innerPadding: ViewStyle = {
    paddingTop: padValue,
    paddingBottom: padValue,
    paddingLeft: padValue + insets.left,
    paddingRight: padValue + insets.right,
  };

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, innerPadding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brandAccent}
            colors={[colors.brandAccent]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, innerPadding, contentStyle]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={[containerStyle, style]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {dismissKeyboardOnTap ? (
        <Pressable style={styles.flex} onPress={Keyboard.dismiss}>
          {body}
        </Pressable>
      ) : (
        body
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});
