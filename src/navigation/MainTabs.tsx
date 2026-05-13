import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatsScreen } from "../features/chats/screens/ChatsScreen";
import { DashboardHomeScreen } from "../features/dashboard/screens/DashboardHomeScreen";
import { ScheduleScreen } from "../features/schedule/screens/ScheduleScreen";
import { colors } from "../theme";
import { MenuNavigator } from "./MenuNavigator";
import type { MainTabParamList } from "./types";
import { useAuth } from "../features/auth/context/AuthContext";
import { AccountType } from "../constants/accountType";
import { useNotifications } from "../features/notifications/NotificationContext";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const { accountType } = useAuth();
  const { unreadCount } = useNotifications();
  const isTrainer = accountType === AccountType.TRAINER;
  const insets = useSafeAreaInsets();
  const tabPadBottom = Math.max(insets.bottom, 6);
  const tabPadTop = 6;
  const tabMinHeight = 52 + tabPadTop + tabPadBottom;

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
        /** Hide the bar while the keyboard is open so chat / form screens
         *  don't render two competing chrome rows on small phones. */
        tabBarHideOnKeyboard: true,
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
          /** Web parity badge: surface the inbox count on the bottom-tab "More" entry. */
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.danger,
            color: colors.background,
            fontWeight: "700",
          },
        }}
      />
    </Tab.Navigator>
  );
}
