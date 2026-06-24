import React from "react";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { AppScreenHeader } from "./AppScreenHeader";
import type { useThemeColors } from "../theme";
import { homeStackScreenOptions } from "./stackTransitions";

/** Consistent custom header: framed drawer mark + centered title. */
export function mainStackHeaderOptions(
  c: ReturnType<typeof useThemeColors>
): NativeStackNavigationOptions {
  return {
    ...homeStackScreenOptions(),
    headerShown: true,
    header: (props) => <AppScreenHeader {...props} />,
    headerShadowVisible: false,
    headerBackVisible: false,
    contentStyle: { backgroundColor: c.background },
  };
}
