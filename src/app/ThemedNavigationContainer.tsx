import { NavigationContainer, type Theme as NavigationTheme } from "@react-navigation/native";
import React, { useMemo } from "react";
import { navigationRef } from "../navigation/navigationRef";
import { AppStatusBar } from "../theme/AppStatusBar";
import { buildNavigationTheme } from "../theme/navigationTheme";
import { useTheme } from "../theme/ThemeContext";
import { RootNavigator } from "../navigation/RootNavigator";

type Props = {
  children?: React.ReactNode;
};

/** Navigation shell with React Navigation theme derived from app ThemeProvider. */
export function ThemedNavigationContainer({ children }: Props) {
  const { scheme, colors } = useTheme();
  const navTheme = useMemo<NavigationTheme>(
    () => buildNavigationTheme(scheme, colors),
    [scheme, colors]
  );

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <AppStatusBar />
      {children ?? <RootNavigator />}
    </NavigationContainer>
  );
}
