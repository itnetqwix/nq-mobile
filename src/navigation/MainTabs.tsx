import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatsScreen } from "../features/chats/screens/ChatsScreen";
import { ScheduleScreen } from "../features/schedule/screens/ScheduleScreen";
import { useThemeColors } from "../theme";
import { AppScreenHeader } from "./AppScreenHeader";
import { HomeNavigator } from "./HomeNavigator";
import { TabSwipeShell } from "./TabSwipeShell";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

const SESSIONS_TAB_LABEL = "Sessions";

function tabHeaderOptions(title: string) {
  return {
    headerShown: true as const,
    title,
    header: (props: React.ComponentProps<typeof AppScreenHeader>) => (
      <AppScreenHeader {...props} />
    ),
    headerShadowVisible: false,
    headerBackVisible: false,
  };
}

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
        animation: "shift",
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
          tabBarLabel: "Dashboard",
          headerShown: false,
        }}
      >
        {() => (
          <TabSwipeShell tabIndex={0}>
            <HomeNavigator />
          </TabSwipeShell>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Schedule"
        options={{
          ...tabHeaderOptions(SESSIONS_TAB_LABEL),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" color={color} size={size} />
          ),
          tabBarLabel: SESSIONS_TAB_LABEL,
        }}
      >
        {(props) => (
          <TabSwipeShell tabIndex={1}>
            <ScheduleScreen {...props} />
          </TabSwipeShell>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Chats"
        options={{
          ...tabHeaderOptions("Chats"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" color={color} size={size} />
          ),
        }}
      >
        {(props) => (
          <TabSwipeShell tabIndex={2}>
            <ChatsScreen {...props} />
          </TabSwipeShell>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
