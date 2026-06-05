/**
 * Shared chrome for MainTabs screens — consistent flex root, surface
 * background, and optional floating-tab-bar clearance.
 *
 * Tab screens historically duplicated `flex:1` + background + manual
 * insets. Mount list/scroll bodies here so layout stays consistent
 * across Home, Chats, Schedule, and Wallet.
 */

import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { space, useThemeColors } from "../../theme";
import { useFloatingTabBarBottomInset } from "../../navigation/useFloatingTabBarBottomInset";
import { useHorizontalGutter } from "./useHorizontalGutter";

type SpaceKey = keyof typeof space;

export type TabScreenShellProps = {
  children: React.ReactNode;
  /** Apply horizontal safe-area gutter on the shell (default false — most tabs pad per-section). */
  padHorizontal?: boolean;
  gutter?: SpaceKey;
  /** Reserve space above the floating tab bar pill (default true). */
  clearFloatingTabBar?: boolean;
  /** Extra bottom inset on the shell (e.g. FAB clearance). */
  bottomInsetExtra?: number;
  background?: string;
  header?: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
};

export function TabScreenShell({
  children,
  padHorizontal = false,
  gutter = "md",
  clearFloatingTabBar = true,
  bottomInsetExtra = 0,
  background,
  header,
  style,
  contentStyle,
}: TabScreenShellProps) {
  const c = useThemeColors();
  const horizontal = useHorizontalGutter(gutter);
  const tabBarPad = useFloatingTabBarBottomInset(bottomInsetExtra);

  const horizontalStyle: ViewStyle | undefined = padHorizontal
    ? { paddingLeft: horizontal.paddingLeft, paddingRight: horizontal.paddingRight }
    : undefined;

  const bottomStyle: ViewStyle | undefined =
    clearFloatingTabBar && tabBarPad > 0 ? { paddingBottom: tabBarPad } : undefined;

  return (
    <View style={[styles.root, { backgroundColor: background ?? c.surface }, style]}>
      {header}
      <View style={[styles.flex, horizontalStyle, bottomStyle, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
});
