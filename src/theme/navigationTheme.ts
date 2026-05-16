import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
  type Theme as NavigationTheme,
} from "@react-navigation/native";
import type { AppColors } from "./colors";

export function buildNavigationTheme(scheme: "light" | "dark", colors: AppColors): NavigationTheme {
  const base = scheme === "dark" ? NavDarkTheme : NavDefaultTheme;
  return {
    ...base,
    dark: scheme === "dark",
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surfaceElevated,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };
}
