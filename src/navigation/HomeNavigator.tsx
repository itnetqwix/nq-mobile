import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useThemeColors } from "../theme";
import { dashboardRouteById } from "../features/dashboard/config/dashboardRoutes";
import { shellSurfaceById } from "../features/dashboard/config/shellSurfaces";
import { DashboardHomeEntry } from "./DashboardHomeEntry";
import { DashboardFeatureScreen } from "../features/dashboard/screens/DashboardFeatureScreen";
import { ShellSurfaceScreen } from "../features/dashboard/screens/ShellSurfaceScreen";
import { TransactionDetailScreen } from "../features/dashboard/screens/TransactionDetailScreen";
import { ReportIssueScreen } from "../features/dashboard/screens/ReportIssueScreen";
import { ActiveSessionsScreen } from "../features/auth/screens/ActiveSessionsScreen";
import { StoragePlanScreen } from "../features/settings/screens/StoragePlanScreen";
import { ArchivedChatsScreen } from "../features/chats/screens/ArchivedChatsScreen";
import i18n from "../i18n";
import { localizedDashboardTitle } from "../i18n/dashboardRouteI18n";
import { localizedShellTitle } from "../i18n/shellSurfaceI18n";
import { mainStackHeaderOptions } from "./mainTabHeaderOptions";
import type { HomeStackParamList } from "./types";

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeNavigator() {
  const c = useThemeColors();
  const header = mainStackHeaderOptions(c);

  return (
    <Stack.Navigator
      initialRouteName="DashboardHome"
      screenOptions={{
        ...header,
        headerShown: true,
      }}
    >
      <Stack.Screen
        name="DashboardHome"
        component={DashboardHomeEntry}
        options={{ title: i18n.t("nav.dashboard") }}
      />
      <Stack.Screen
        name="DashboardFeature"
        component={DashboardFeatureScreen}
        options={({ route }) => {
          const meta = dashboardRouteById(route.params.featureId);
          return {
            title: meta ? localizedDashboardTitle(i18n.t, meta) : i18n.t("nav.dashboard"),
          };
        }}
      />
      <Stack.Screen
        name="ShellSurface"
        component={ShellSurfaceScreen}
        options={({ route }) => {
          const meta = shellSurfaceById(route.params.surfaceId);
          return {
            title: meta ? localizedShellTitle(i18n.t, meta) : "NetQwix",
            headerShown: true,
          };
        }}
      />
      <Stack.Screen
        name="TransactionDetail"
        component={TransactionDetailScreen}
        options={{ title: i18n.t("wallet.transaction") }}
      />
      <Stack.Screen
        name="ReportIssue"
        component={ReportIssueScreen}
        options={{ title: i18n.t("nav.reportIssue") }}
      />
      <Stack.Screen
        name="ActiveSessions"
        component={ActiveSessionsScreen}
        options={{ title: i18n.t("auth.activeSessions") }}
      />
      <Stack.Screen
        name="StoragePlan"
        component={StoragePlanScreen}
        options={{ title: i18n.t("storage.title") }}
      />
      <Stack.Screen
        name="ArchivedChats"
        component={ArchivedChatsScreen}
        options={{ title: i18n.t("chats.archivedTitle") }}
      />
    </Stack.Navigator>
  );
}
