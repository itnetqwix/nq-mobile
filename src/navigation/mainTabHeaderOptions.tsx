import React from "react";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { DrawerMarkButton } from "./DrawerMarkButton";
import type { useThemeColors } from "../theme";

/** Consistent stack header: drawer mark on the left, no back chevron. */
export function mainStackHeaderOptions(
  c: ReturnType<typeof useThemeColors>
): NativeStackNavigationOptions {
  return {
    headerTintColor: c.headerTint,
    headerTitleStyle: { fontWeight: "700", color: c.headerTitle, fontSize: 17 },
    headerTitleAlign: "center",
    headerStyle: {
      backgroundColor: c.background,
    },
    headerShadowVisible: false,
    headerBackVisible: false,
    headerLeft: () => <DrawerMarkButton />,
    contentStyle: { backgroundColor: c.background },
    gestureEnabled: false,
    animation: "fade",
  };
}
