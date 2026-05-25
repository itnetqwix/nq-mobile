import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatsScreen } from "../features/chats/screens/ChatsScreen";
import { GuestTabGateScreen } from "../features/auth/screens/GuestTabGateScreen";
import { useGuestMode } from "../features/auth/hooks/useGuestMode";
import { ScheduleScreen } from "../features/schedule/screens/ScheduleScreen";
import { useThemeColors } from "../theme";
import { AppScreenHeader } from "./AppScreenHeader";
import { HomeNavigator } from "./HomeNavigator";
import { TabSwipeShell } from "./TabSwipeShell";
import { haptics } from "../lib/haptics";
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
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const isGuest = useGuestMode();
  const navigation = useNavigation();
  const tabPadBottom = Math.max(insets.bottom, 6);
  const tabPadTop = 6;
  const tabMinHeight = 52 + tabPadTop + tabPadBottom;

  // Defensive: any ancestor of MainTabs (the Drawer "Tabs" screen and the
  // root Stack "Main" screen) should *never* show its own header. A previous
  // buggy version of useChatRoomChrome could flip those to `headerShown:true`
  // and persist the override, leaking the route name "Main" and the drawer
  // title "NetQwix" above the dashboard. Force them headerless on mount.
  useEffect(() => {
    const parent: any = navigation?.getParent?.();        // Drawer
    const grandparent: any = parent?.getParent?.();        // Root Stack
    try { parent?.setOptions?.({ headerShown: false }); } catch {}
    try { grandparent?.setOptions?.({ headerShown: false }); } catch {}
  }, [navigation]);

  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: () => haptics.tap(),
      }}
      screenOptions={{
        headerShown: false,
        lazy: true,
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
                flavor="schedule"
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
        }}
      >
        {(props) => (
          <TabSwipeShell tabIndex={2}>
            {isGuest ? (
              <GuestTabGateScreen
                icon="chatbubbles-outline"
                titleKey="guest.chatsTitle"
                bodyKey="guest.chatsBody"
                flavor="chats"
              />
            ) : (
              <ChatsScreen {...props} />
            )}
          </TabSwipeShell>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
