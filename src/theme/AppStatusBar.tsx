import { StatusBar } from "expo-status-bar";
import React from "react";
import { useTheme } from "./ThemeContext";

export function AppStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
}
