import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DrawerMarkButton } from "./DrawerMarkButton";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatsScreen } from "../features/chats/screens/ChatsScreen";
import { ScheduleScreen } from "../features/schedule/screens/ScheduleScreen";
import { useThemeColors } from "../theme";
import { HomeNavigator } from "./HomeNavigator";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

const SESSIONS_TAB_LABEL = "Sessions";

export function MainTabs() {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const tabPadBottom = Math.max(insets.bottom, 6);
  const tabPadTop = 6;
  const tabMinHeight = 52 + tabPadTop + tabPadBottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.tabBarActive,
        tabBarInactiveTintColor: c.tabBarInactive,
        tabBarStyle: {
          borderTopColor: c.tabBarBorder,
          backgroundColor: c.tabBar,
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
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeNavigator}
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
          tabBarLabel: "Dashboard",
        }}
      />
      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{
          title: SESSIONS_TAB_LABEL,
          headerShown: true,
          headerTitle: SESSIONS_TAB_LABEL,
          headerTitleAlign: "center",
          headerStyle: {
            backgroundColor: c.background,
            borderBottomColor: c.border,
            borderBottomWidth: 1,
          },
          headerTitleStyle: { fontWeight: "700", color: c.headerTitle, fontSize: 17 },
          headerLeft: () => <DrawerMarkButton />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" color={color} size={size} />
          ),
          tabBarLabel: SESSIONS_TAB_LABEL,
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
    </Tab.Navigator>
  );
}
