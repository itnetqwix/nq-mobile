import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DrawerToggleButton } from "@react-navigation/drawer";
import React from "react";
import { useThemeColors } from "../theme";
import { dashboardRouteById } from "../features/dashboard/config/dashboardRoutes";
import { shellSurfaceById } from "../features/dashboard/config/shellSurfaces";
import { DashboardFeatureScreen } from "../features/dashboard/screens/DashboardFeatureScreen";
import { MenuHomeScreen } from "../features/dashboard/screens/MenuHomeScreen";
import { ShellSurfaceScreen } from "../features/dashboard/screens/ShellSurfaceScreen";
import type { MenuStackParamList } from "./types";

const Stack = createNativeStackNavigator<MenuStackParamList>();

export function MenuNavigator() {
  const c = useThemeColors();
  return (
    <Stack.Navigator
      initialRouteName="ShellSurface"
      screenOptions={{
        headerTintColor: c.brandNavy,
        headerTitleStyle: { fontWeight: "600", color: c.brandNavy },
        headerStyle: { backgroundColor: c.background },
        headerLeft: () => <DrawerToggleButton tintColor={c.brandNavy} />,
        contentStyle: { backgroundColor: c.background },
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
          headerLeft: undefined,
        })}
      />
      <Stack.Screen
        name="ShellSurface"
        component={ShellSurfaceScreen}
        initialParams={{ surfaceId: "settings" }}
        options={({ route, navigation }) => ({
          title: shellSurfaceById(route.params.surfaceId)?.title ?? "NetQwix",
          headerLeft: navigation.canGoBack() ? undefined : () => <DrawerToggleButton tintColor={c.brandNavy} />,
        })}
      />
    </Stack.Navigator>
  );
}
