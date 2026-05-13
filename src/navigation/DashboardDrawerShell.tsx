import { createDrawerNavigator } from "@react-navigation/drawer";
import React from "react";
import { colors, layout } from "../theme";
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
        overlayColor: colors.scrim,
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
