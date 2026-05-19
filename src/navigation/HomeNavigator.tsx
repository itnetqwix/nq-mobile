import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useThemeColors } from "../theme";
import { dashboardRouteById } from "../features/dashboard/config/dashboardRoutes";
import { shellSurfaceById } from "../features/dashboard/config/shellSurfaces";
import { DashboardHomeScreen } from "../features/dashboard/screens/DashboardHomeScreen";
import { DashboardFeatureScreen } from "../features/dashboard/screens/DashboardFeatureScreen";
import { ShellSurfaceScreen } from "../features/dashboard/screens/ShellSurfaceScreen";
import { TransactionDetailScreen } from "../features/dashboard/screens/TransactionDetailScreen";
import { ReportIssueScreen } from "../features/dashboard/screens/ReportIssueScreen";
import { ActiveSessionsScreen } from "../features/auth/screens/ActiveSessionsScreen";
import { StoragePlanScreen } from "../features/settings/screens/StoragePlanScreen";
import { ArchivedChatsScreen } from "../features/chats/screens/ArchivedChatsScreen";
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
        component={DashboardHomeScreen}
        options={{ title: "Dashboard" }}
      />
      <Stack.Screen
        name="DashboardFeature"
        component={DashboardFeatureScreen}
        options={({ route }) => ({
          title: dashboardRouteById(route.params.featureId)?.title ?? "Dashboard",
        })}
      />
      <Stack.Screen
        name="ShellSurface"
        component={ShellSurfaceScreen}
        options={({ route }) => {
          const meta = shellSurfaceById(route.params.surfaceId);
          return {
            title: meta?.title ?? "NetQwix",
            headerShown: true,
          };
        }}
      />
      <Stack.Screen
        name="TransactionDetail"
        component={TransactionDetailScreen}
        options={{ title: "Transaction" }}
      />
      <Stack.Screen
        name="ReportIssue"
        component={ReportIssueScreen}
        options={{ title: "Report an issue" }}
      />
      <Stack.Screen
        name="ActiveSessions"
        component={ActiveSessionsScreen}
        options={{ title: "Active sessions" }}
      />
      <Stack.Screen
        name="StoragePlan"
        component={StoragePlanScreen}
        options={{ title: "Storage" }}
      />
      <Stack.Screen
        name="ArchivedChats"
        component={ArchivedChatsScreen}
        options={{ title: "Archived chats" }}
      />
    </Stack.Navigator>
  );
}
