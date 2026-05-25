/**
 * `MorphRefreshHeader` — a WhatsApp-Status-style pull-to-refresh header.
 *
 * Drop above a `ScrollView` / `FlatList` content and connect it to the
 * list's `onScroll` via the helper hook. The component:
 *   • renders an arrow that grows + rotates as the user pulls
 *   • morphs the arrow into a check-mark the instant the threshold is hit
 *   • plays a single haptic tick on the morph (matches point 8.5)
 *   • shrinks back when the gesture is released
 *
 * Intentionally lightweight — we do NOT replace `RefreshControl` (it owns
 * the spinner / promise lifecycle). Instead we *augment* the existing pull
 * with a richer visual + haptic, while keeping fallback behaviour identical
 * on screens that don't opt in.
 *
 * Usage:
 *   const { scrollProps, headerProps } = useMorphRefresh({ onRefresh });
 *   <MorphRefreshHeader {...headerProps} />
 *   <ScrollView {...scrollProps} />
 *
 * Reduced-motion users: the morph animation is disabled and we simply
 * show a static arrow / check — the haptic still fires so the intent is
 * conveyed.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useThemeColors } from "../../theme";

export const MORPH_THRESHOLD = 72;

export type MorphRefreshHeaderProps = {
  /** Animated.Value bound to the scroll offset (negative when overscrolling). */
  pullValue: Animated.Value;
  /** `true` once the threshold is crossed — pass from the hook. */
  released: boolean;
};

export function MorphRefreshHeader({ pullValue, released }: MorphRefreshHeaderProps) {
  const c = useThemeColors();

  /** Negative offset → positive pull distance in [0, MORPH_THRESHOLD+]. */
  const pullDistance = pullValue.interpolate({
    inputRange: [-MORPH_THRESHOLD * 1.5, 0],
    outputRange: [MORPH_THRESHOLD * 1.5, 0],
    extrapolate: "clamp",
  });

  /** Arrow rotation: 0deg at rest, 180deg right at threshold. */
  const rotate = pullValue.interpolate({
    inputRange: [-MORPH_THRESHOLD, 0],
    outputRange: ["180deg", "0deg"],
    extrapolate: "clamp",
  });

  const opacity = pullValue.interpolate({
    inputRange: [-MORPH_THRESHOLD * 0.4, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          height: pullDistance,
          opacity,
        },
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: released ? c.success : c.brandAccentSubtle,
            borderColor: released ? c.success : c.brandAccent,
          },
        ]}
      >
        {released ? (
          <Ionicons name="checkmark" size={20} color={"#fff"} />
        ) : (
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="arrow-down" size={20} color={c.brandAccent} />
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
    paddingTop: 6,
  },
  bubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
