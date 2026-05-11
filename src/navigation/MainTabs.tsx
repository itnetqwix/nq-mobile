import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ChatsScreen } from "../features/chats/screens/ChatsScreen";
import { DashboardHomeScreen } from "../features/dashboard/screens/DashboardHomeScreen";
import { ScheduleScreen } from "../features/schedule/screens/ScheduleScreen";
import { colors } from "../theme/tokens";
import { MenuNavigator } from "./MenuNavigator";
import type { MainTabParamList } from "./types";
import { useAuth } from "../features/auth/context/AuthContext";
import { AccountType } from "../constants/accountType";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const { accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;

  // Schedule tab shows "Schedule" for trainers, "Sessions" for trainees — mirrors website sidebar
  const scheduleTabLabel = isTrainer ? "Schedule" : "Sessions";
  const scheduleTabIcon = isTrainer ? "calendar-outline" : "time-outline";

  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleAlign: "center",
        tabBarActiveTintColor: colors.brandNavy,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopColor: colors.tabBarBorder,
          backgroundColor: colors.background,
        },
        headerStyle: {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontWeight: "700",
          color: colors.brandNavy,
          fontSize: 17,
        },
        headerLeft: () => <DrawerToggleButton tintColor={colors.brandNavy} />,
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardHomeScreen}
        options={{
          title: "My Locker",
          headerShown: true,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{
          title: scheduleTabLabel,
          headerTitle: scheduleTabLabel,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={scheduleTabIcon as any} color={color} size={size} />
          ),
          tabBarLabel: scheduleTabLabel,
        }}
      />
      <Tab.Screen
        name="Chats"
        component={ChatsScreen}
        options={{
          title: "Chats",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Menu"
        component={MenuNavigator}
        options={{
          title: "More",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu-outline" color={color} size={size} />
          ),
          tabBarLabel: "More",
        }}
      />
    </Tab.Navigator>
  );
}
