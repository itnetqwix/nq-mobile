import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ChatsScreen } from "../features/chats/screens/ChatsScreen";
import { GuestTabGateScreen } from "../features/auth/screens/GuestTabGateScreen";
import { useGuestMode } from "../features/auth/hooks/useGuestMode";
import { ScheduleScreen } from "../features/schedule/screens/ScheduleScreen";
import { useThemeColors } from "../theme";
import { AppScreenHeader } from "./AppScreenHeader";
import { FloatingTabBar } from "./FloatingTabBar";
import { TabBarScrollProvider } from "./TabBarScrollContext";
import { HomeNavigator } from "./HomeNavigator";
import { CaptureNavigator } from "./CaptureNavigator";
import { TabSwipeShell } from "./TabSwipeShell";
import i18n from "../i18n";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

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
  const c = useThemeColors();
  const isGuest = useGuestMode();

  return (
    <TabBarScrollProvider>
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarActiveTintColor: c.tabBarActive,
        tabBarInactiveTintColor: c.tabBarInactive,
        // Visual styling is handled by `FloatingTabBar` pill.
        tabBarStyle: { backgroundColor: "transparent", borderTopWidth: 0 },
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
          title: i18n.t("tabs.home"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
          tabBarLabel: i18n.t("tabs.home"),
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
          ...tabHeaderOptions(i18n.t("tabs.sessions")),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" color={color} size={size} />
          ),
          tabBarLabel: i18n.t("tabs.sessions"),
        }}
      >
        {(props) => (
          <TabSwipeShell tabIndex={1}>
            {isGuest ? (
              <GuestTabGateScreen
                icon="time-outline"
                titleKey="guest.sessionsTitle"
                bodyKey="guest.sessionsBody"
              />
            ) : (
              <ScheduleScreen {...props} />
            )}
          </TabSwipeShell>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Chats"
        options={{
          ...tabHeaderOptions(i18n.t("tabs.chats")),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" color={color} size={size} />
          ),
          tabBarLabel: i18n.t("tabs.chats"),
        }}
      >
        {(props) => (
          <TabSwipeShell tabIndex={2}>
            {isGuest ? (
              <GuestTabGateScreen
                icon="chatbubbles-outline"
                titleKey="guest.chatsTitle"
                bodyKey="guest.chatsBody"
              />
            ) : (
              <ChatsScreen {...props} />
            )}
          </TabSwipeShell>
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Capture"
        component={CaptureNavigator}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="videocam-outline" color={color} size={size} />
          ),
          tabBarLabel: i18n.t("tabs.capture", { defaultValue: "Capture" }),
        }}
      />
    </Tab.Navigator>
    </TabBarScrollProvider>
  );
}
