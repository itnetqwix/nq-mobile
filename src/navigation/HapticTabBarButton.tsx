import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import React from "react";
import type { GestureResponderEvent } from "react-native";
import { haptics } from "../lib/haptics";

/**
 * Tab bar button with haptic feedback — must use PlatformPressable (same as
 * React Navigation default) so refs / press handling stay compatible.
 */
export function HapticTabBarButton({
  onPress,
  ...rest
}: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...rest}
      onPress={(event: GestureResponderEvent) => {
        haptics.tap();
        onPress?.(event);
      }}
    />
  );
}
