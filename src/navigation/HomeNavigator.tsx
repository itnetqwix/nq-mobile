import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DrawerMarkButton } from "./DrawerMarkButton";
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
import type { HomeStackParamList, ShellSurfaceRouteId } from "./types";

const Stack = createNativeStackNavigator<HomeStackParamList>();

function shellHeaderShown(surfaceId: ShellSurfaceRouteId): boolean {
  return surfaceId !== "wallet";
}

export function HomeNavigator() {
  const c = useThemeColors();

  return (
    <Stack.Navigator
      initialRouteName="DashboardHome"
      screenOptions={({ navigation }) => ({
        headerTintColor: c.headerTint,
        headerTitleStyle: { fontWeight: "700", color: c.headerTitle, fontSize: 17 },
        headerStyle: {
          backgroundColor: c.background,
          borderBottomColor: c.border,
          borderBottomWidth: 1,
        },
        headerShadowVisible: false,
        headerBackTitleVisible: false,
        contentStyle: { backgroundColor: c.background },
        gestureEnabled: true,
        gestureDirection: "horizontal",
        animation: "slide_from_right",
        headerLeft: navigation.canGoBack()
          ? undefined
          : () => <DrawerMarkButton />,
      })}
    >
      <Stack.Screen
        name="DashboardHome"
        component={DashboardHomeScreen}
        options={{
          title: "Dashboard",
        }}
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
            headerShown: shellHeaderShown(route.params.surfaceId),
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
    </Stack.Navigator>
  );
}
