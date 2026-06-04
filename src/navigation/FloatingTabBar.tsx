import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useThemeColors } from "../theme";
import { useTabBarAnimatedOffset } from "./TabBarScrollContext";

/** Height of the pill bar itself (excluding outer margins and safe area). */
export const FLOATING_TAB_BAR_HEIGHT = 58;
/** Gap between screen bottom safe area and the floating pill. */
export const FLOATING_TAB_BAR_BOTTOM_GAP = 10;
/** Horizontal inset from screen edges. */
export const FLOATING_TAB_BAR_HORIZONTAL_INSET = 16;

const SCROLL_CLEARANCE_BELOW_BAR = 8;

/** Total scroll padding so list content clears the floating bar. */
export function floatingTabBarBottomInset(safeBottom: number): number {
  return (
    safeBottom +
    FLOATING_TAB_BAR_BOTTOM_GAP +
    FLOATING_TAB_BAR_HEIGHT +
    SCROLL_CLEARANCE_BELOW_BAR
  );
}

type Props = BottomTabBarProps;

/**
 * Detached bottom tab bar: rounded pill floating above the home indicator,
 * with soft shadow — not edge-to-edge attached.
 */
export function FloatingTabBar(props: Props) {
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const c = useThemeColors();
  const animatedHost = useTabBarAnimatedOffset();
  const bottomPad = Math.max(insets.bottom, FLOATING_TAB_BAR_BOTTOM_GAP);
  const focusedRouteKey = props.state.routes[props.state.index]?.key;
  const focusedOptions = focusedRouteKey ? props.descriptors[focusedRouteKey]?.options : undefined;
  const tabBarStyle = focusedOptions?.tabBarStyle;
  const hidden = StyleSheet.flatten(tabBarStyle as any)?.display === "none";
  if (hidden) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.host,
        { paddingBottom: bottomPad, paddingHorizontal: FLOATING_TAB_BAR_HORIZONTAL_INSET },
        animatedHost,
      ]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: c.tabBar,
            borderColor: c.tabBarBorder,
            ...Platform.select({
              ios: {
                shadowColor: scheme === "dark" ? "#000" : "#1e3a5f",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: scheme === "dark" ? 0.45 : 0.12,
                shadowRadius: 16,
              },
              android: { elevation: 12 },
              default: {},
            }),
          },
        ]}
      >
        <BottomTabBar
          {...props}
          style={styles.innerBar}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  pill: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    minHeight: FLOATING_TAB_BAR_HEIGHT,
  },
  innerBar: {
    backgroundColor: "transparent",
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    height: FLOATING_TAB_BAR_HEIGHT,
    paddingTop: 6,
    paddingBottom: 6,
  },
});
