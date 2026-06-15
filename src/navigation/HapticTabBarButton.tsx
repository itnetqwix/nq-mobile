import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import React from "react";
import { Pressable, type GestureResponderEvent } from "react-native";
import { haptics } from "../lib/haptics";

/** Bottom-tab button that fires a light tap haptic before navigation. */
export function HapticTabBarButton(props: BottomTabBarButtonProps) {
  const { onPress, ...rest } = props;
  return (
    <Pressable
      {...rest}
      onPress={(event: GestureResponderEvent) => {
        haptics.tap();
        onPress?.(event);
      }}
    />
  );
}
