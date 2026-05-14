import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatsScreen } from "../features/chats/screens/ChatsScreen";
import { DashboardHomeScreen } from "../features/dashboard/screens/DashboardHomeScreen";
import { ScheduleScreen } from "../features/schedule/screens/ScheduleScreen";
import { useThemeColors } from "../theme";
import { MenuNavigator } from "./MenuNavigator";
import type { MainTabParamList } from "./types";
import { useAuth } from "../features/auth/context/AuthContext";
import { AccountType } from "../constants/accountType";
const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const { accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const tabPadBottom = Math.max(insets.bottom, 6);
  const tabPadTop = 6;
  const tabMinHeight = 52 + tabPadTop + tabPadBottom;

  const scheduleTabLabel = isTrainer ? "Schedule" : "Sessions";
  const scheduleTabIcon = isTrainer ? "calendar-outline" : "time-outline";

  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleAlign: "center",
        tabBarActiveTintColor: c.brandNavy,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          borderTopColor: c.tabBarBorder,
          backgroundColor: c.background,
          paddingTop: tabPadTop,
          paddingBottom: tabPadBottom,
          paddingLeft: Math.max(insets.left, 4),
          paddingRight: Math.max(insets.right, 4),
          minHeight: tabMinHeight,
          height: undefined,
        },
        tabBarLabelStyle: {
          fontWeight: "600",
          fontSize: 11,
        },
        tabBarHideOnKeyboard: true,
        headerStyle: {
          backgroundColor: c.background,
          borderBottomColor: c.border,
          borderBottomWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontWeight: "700",
          color: c.brandNavy,
          fontSize: 17,
        },
        headerLeft: () => <DrawerToggleButton tintColor={c.brandNavy} />,
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
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Menu"
        component={MenuNavigator}
        options={{
          title: "Settings",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
          tabBarLabel: "Settings",
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate("Menu", {
              screen: "ShellSurface",
              params: { surfaceId: "settings" },
            });
          },
        })}
      />
    </Tab.Navigator>
  );
}
