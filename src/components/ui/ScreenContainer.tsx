import React, { useCallback, useMemo } from "react";
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
import {
  computeScrollKeyboardPadding,
  keyboardAvoidingBehavior,
  keyboardScrollExtraInset,
  useKeyboardSheetInsets,
} from "../../lib/keyboard";
import { useMorphRefreshBundle } from "../../lib/refresh/useMorphRefreshBundle";
import { space, useThemeColors } from "../../theme";
import { floatingTabBarBottomInset } from "../../navigation/FloatingTabBar";
import { MorphRefreshHeader } from "./MorphRefreshHeader";

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
  /** Extra bottom padding for floating MainTabs pill (~76px + safe area). */
  clearFloatingTabBar?: boolean;
  /** Pinned footer outside scroll (submit buttons) — stays above keyboard. */
  footer?: React.ReactNode;
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
  clearFloatingTabBar = false,
  footer,
  children,
}: ScreenContainerProps) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { keyboardOpen, keyboardHeight } = useKeyboardSheetInsets();
  const padValue = padding === 0 ? 0 : space[padding];
  const tabBarPad = clearFloatingTabBar ? floatingTabBarBottomInset(insets.bottom) : 0;

  const morphOnRefresh = useCallback(async () => {
    onRefresh?.();
  }, [onRefresh]);
  const morph = useMorphRefreshBundle(morphOnRefresh, !!(refreshing && onRefresh));

  const scrollBottomPad = useMemo(() => {
    const closedBottom = padValue + tabBarPad + (applyBottomInset ? insets.bottom : 0);
    return (
      computeScrollKeyboardPadding({
        keyboardOpen,
        keyboardHeight,
        safeBottom: insets.bottom,
        closedBottomPad: closedBottom,
        footerSlot: footer ? 88 : 0,
      }) +
      keyboardScrollExtraInset(keyboardOpen, keyboardHeight)
    );
  }, [
    applyBottomInset,
    footer,
    insets.bottom,
    keyboardHeight,
    keyboardOpen,
    padValue,
    tabBarPad,
  ]);

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: background ?? c.surface,
    paddingTop: applyTopInset ? insets.top : 0,
    paddingBottom:
      applyBottomInset && !clearFloatingTabBar && !footer && !keyboardOpen ? insets.bottom : 0,
  };

  const innerPadding: ViewStyle = {
    paddingTop: padValue,
    paddingBottom: scroll ? scrollBottomPad : padValue + tabBarPad,
    paddingLeft: padValue + insets.left,
    paddingRight: padValue + insets.right,
  };

  const body = scroll ? (
    <View style={styles.flex}>
      {onRefresh ? <MorphRefreshHeader {...morph.headerProps} /> : null}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, innerPadding, contentStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        onScroll={onRefresh ? morph.onMorphScroll : undefined}
        scrollEventThrottle={onRefresh ? morph.scrollEventThrottle : undefined}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={morph.refreshing}
              onRefresh={morph.onRefreshControl}
              tintColor={c.brandAccent}
              colors={[c.brandAccent]}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  ) : (
    <View style={[styles.flex, innerPadding, contentStyle]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView style={[containerStyle, style]} behavior={keyboardAvoidingBehavior()}>
      {dismissKeyboardOnTap ? (
        <Pressable style={styles.flex} onPress={Keyboard.dismiss}>
          {body}
        </Pressable>
      ) : (
        body
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
  scrollContent: { flexGrow: 1 },
  footer: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
});
