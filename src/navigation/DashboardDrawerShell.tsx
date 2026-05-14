import { createDrawerNavigator } from "@react-navigation/drawer";
import React from "react";
import { useThemeColors, layout } from "../theme";
import { DashboardDrawerContent } from "./DashboardDrawerContent";
import { MainTabs } from "./MainTabs";
import type { DashboardDrawerParamList } from "./types";

const Drawer = createDrawerNavigator<DashboardDrawerParamList>();

export function DashboardDrawerShell() {
  const c = useThemeColors();
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DashboardDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: {
          width: layout.drawerWidth,
          backgroundColor: c.background,
        },
        overlayColor: c.scrim,
      }}
    >
      <Drawer.Screen
        name="Tabs"
        component={MainTabs}
        options={{ title: "NetQwix" }}
      />
    </Drawer.Navigator>
  );
}
