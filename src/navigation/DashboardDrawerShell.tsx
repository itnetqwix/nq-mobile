import { createDrawerNavigator } from "@react-navigation/drawer";
import React from "react";
import { colors, layout } from "../theme/tokens";
import { DashboardDrawerContent } from "./DashboardDrawerContent";
import { MainTabs } from "./MainTabs";
import type { DashboardDrawerParamList } from "./types";

const Drawer = createDrawerNavigator<DashboardDrawerParamList>();

export function DashboardDrawerShell() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DashboardDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: {
          width: layout.drawerWidth,
          backgroundColor: colors.background,
        },
        overlayColor: "rgba(15, 23, 42, 0.4)",
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
