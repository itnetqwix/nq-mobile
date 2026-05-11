import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import type { MenuStackParamList } from "../../../navigation/types";
import { NotificationsScreen } from "../../notifications/screens/NotificationsScreen";
import { TransactionsScreen } from "./TransactionsScreen";
import { UploadsScreen } from "./UploadsScreen";
import { SettingsScreen } from "./SettingsScreen";

export type ShellSurfaceScreenProps = NativeStackScreenProps<MenuStackParamList, "ShellSurface">;

export function ShellSurfaceScreen({ route }: ShellSurfaceScreenProps) {
  const { surfaceId } = route.params;

  switch (surfaceId) {
    case "notifications":
      return <NotificationsScreen />;
    case "transactions":
      return <TransactionsScreen />;
    case "uploads":
      return <UploadsScreen />;
    case "settings":
      return <SettingsScreen />;
    default:
      return null;
  }
}
