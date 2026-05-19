import React from "react";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { AppScreenHeader } from "./AppScreenHeader";
import type { useThemeColors } from "../theme";

/** Consistent custom header: framed drawer mark + centered title. */
export function mainStackHeaderOptions(
  c: ReturnType<typeof useThemeColors>
): NativeStackNavigationOptions {
  return {
    headerShown: true,
    header: (props) => <AppScreenHeader {...props} />,
    headerShadowVisible: false,
    headerBackVisible: false,
    contentStyle: { backgroundColor: c.background },
    gestureEnabled: false,
    animation: "fade",
  };
}
