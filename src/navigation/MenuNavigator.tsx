import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DrawerToggleButton } from "@react-navigation/drawer";
import React from "react";
import { colors } from "../theme";
import { dashboardRouteById } from "../features/dashboard/config/dashboardRoutes";
import { shellSurfaceById } from "../features/dashboard/config/shellSurfaces";
import { DashboardFeatureScreen } from "../features/dashboard/screens/DashboardFeatureScreen";
import { MenuHomeScreen } from "../features/dashboard/screens/MenuHomeScreen";
import { ShellSurfaceScreen } from "../features/dashboard/screens/ShellSurfaceScreen";
import type { MenuStackParamList } from "./types";

const Stack = createNativeStackNavigator<MenuStackParamList>();

export function MenuNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.brandNavy,
        headerTitleStyle: { fontWeight: "600", color: colors.brandNavy },
        headerLeft: () => <DrawerToggleButton tintColor={colors.brandNavy} />,
        contentStyle: { backgroundColor: colors.background },
        /** Allow swipe-back gesture on Android too — same right-to-left arc
         *  for every screen pushed inside the More tab. */
        gestureEnabled: true,
        gestureDirection: "horizontal",
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="MenuHome" component={MenuHomeScreen} options={{ title: "Menu" }} />
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
        options={({ route }) => ({
          title: shellSurfaceById(route.params.surfaceId)?.title ?? "NetQwix",
        })}
      />
    </Stack.Navigator>
  );
}
