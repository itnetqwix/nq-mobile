import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../theme";
import { useTabBarAnimatedOffset } from "./TabBarScrollContext";

/** Height of the tab bar content row (excluding safe area). */
export const FLOATING_TAB_BAR_HEIGHT = 56;
/** Legacy constant — fixed bar sits flush on the bottom edge. */
export const FLOATING_TAB_BAR_BOTTOM_GAP = 0;
/** Legacy constant — fixed bar spans full width. */
export const FLOATING_TAB_BAR_HORIZONTAL_INSET = 0;

const SCROLL_CLEARANCE_BELOW_BAR = 8;

/** Scroll padding so list content clears the fixed tab bar. */
export function floatingTabBarBottomInset(safeBottom: number): number {
  return safeBottom + FLOATING_TAB_BAR_HEIGHT + SCROLL_CLEARANCE_BELOW_BAR;
}

type Props = BottomTabBarProps;

/**
 * Fixed bottom tab bar — edge-to-edge, attached to the screen bottom.
 */
export function FloatingTabBar(props: Props) {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const animatedHost = useTabBarAnimatedOffset();
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
        {
          paddingBottom: insets.bottom,
          backgroundColor: c.tabBar,
          borderTopColor: c.tabBarBorder,
        },
        animatedHost,
      ]}
    >
      <View style={styles.bar}>
        <BottomTabBar {...props} style={styles.innerBar} />
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
    borderTopWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  bar: {
    minHeight: FLOATING_TAB_BAR_HEIGHT,
  },
  innerBar: {
    backgroundColor: "transparent",
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    height: FLOATING_TAB_BAR_HEIGHT,
    paddingTop: 4,
    paddingBottom: 4,
  },
});
