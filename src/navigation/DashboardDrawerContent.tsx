import { DrawerContentScrollView, type DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, space } from "../theme/tokens";
import { useAuth } from "../features/auth/context/AuthContext";
import {
  dashboardRoutesForRoles,
  type DashboardRouteId,
  type DashboardRouteMeta,
} from "../features/dashboard/config/dashboardRoutes";
import {
  shellSurfacesForRoles,
  UTILITY_SURFACE_IDS,
  type ShellSurfaceMeta,
} from "../features/dashboard/config/shellSurfaces";
import { AccountType } from "../constants/accountType";
import type { MainTabParamList } from "./types";
import type { NavigatorScreenParams } from "@react-navigation/native";

const TAB_PRIMARY: { tab: keyof MainTabParamList; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { tab: "Home", label: "My Locker", icon: "home-outline" },
  { tab: "Schedule", label: "Schedule", icon: "calendar-outline" },
  { tab: "Chats", label: "Chats", icon: "chatbubbles-outline" },
];

function featureIcon(id: DashboardRouteId): keyof typeof Ionicons.glyphMap {
  switch (id) {
    case "instant-booking":
      return "flash-outline";
    case "schedule":
      return "calendar-outline";
    case "book-lesson":
      return "book-outline";
    case "chats":
      return "chatbubbles-outline";
    case "upcoming-sessions":
      return "time-outline";
    case "my-community":
      return "people-outline";
    case "contact-us":
      return "mail-outline";
    case "about-us":
      return "information-circle-outline";
    case "friends":
      return "person-add-outline";
    case "students":
      return "school-outline";
    case "meeting-room":
      return "videocam-outline";
    case "practice-session":
      return "fitness-outline";
    default:
      return "ellipse-outline";
  }
}

function shellIcon(id: ShellSurfaceMeta["id"]): keyof typeof Ionicons.glyphMap {
  switch (id) {
    case "clips":
      return "film-outline";
    case "gamePlans":
      return "clipboard-outline";
    case "savedLessons":
      return "bookmark-outline";
    case "invite":
      return "mail-outline";
    case "notifications":
      return "notifications-outline";
    case "settings":
      return "settings-outline";
    case "transactions":
      return "wallet-outline";
    case "meeting":
      return "videocam-outline";
    case "messenger":
      return "chatbubble-ellipses-outline";
    default:
      return "ellipse-outline";
  }
}

function getFocusedTabName(drawerState: DrawerContentComponentProps["state"]): keyof MainTabParamList | null {
  const tabsRoute = drawerState.routes.find((r) => r.name === "Tabs");
  const tabState = tabsRoute?.state as { routes?: { name: string }[]; index?: number } | undefined;
  if (!tabState?.routes?.length || tabState.index == null) return null;
  const name = tabState.routes[tabState.index]?.name;
  if (name === "Home" || name === "Schedule" || name === "Chats" || name === "Menu") {
    return name as keyof MainTabParamList;
  }
  return null;
}

export function DashboardDrawerContent(props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { accountType, user, signOut } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;

  const scheduleLabel = isTrainer ? "Schedule" : "Sessions";
  const primaryItems = useMemo(
    () =>
      TAB_PRIMARY.map((row) =>
        row.tab === "Schedule" ? { ...row, label: scheduleLabel } : row
      ),
    [scheduleLabel]
  );

  const dashboardPages = useMemo(() => dashboardRoutesForRoles(accountType), [accountType]);
  const secondaryRoutes = useMemo(
    () =>
      dashboardPages.filter(
        (r) => r.id !== "schedule" && r.id !== "chats"
      ),
    [dashboardPages]
  );

  const shellUtilities = useMemo(() => {
    const all = shellSurfacesForRoles(accountType);
    return all.filter((s) =>
      (UTILITY_SURFACE_IDS as readonly string[]).includes(s.id)
    );
  }, [accountType]);

  const focusedTab = getFocusedTabName(props.state);

  const close = () => props.navigation.closeDrawer();

  const goTab = (tab: keyof MainTabParamList) => {
    props.navigation.navigate("Tabs", { screen: tab } as NavigatorScreenParams<MainTabParamList>);
    close();
  };

  const goFeature = (id: DashboardRouteId) => {
    props.navigation.navigate(
      "Tabs",
      {
        screen: "Menu",
        params: { screen: "DashboardFeature", params: { featureId: id } },
      } as NavigatorScreenParams<MainTabParamList>
    );
    close();
  };

  const goShell = (id: ShellSurfaceMeta["id"]) => {
    props.navigation.navigate(
      "Tabs",
      {
        screen: "Menu",
        params: { screen: "ShellSurface", params: { surfaceId: id } },
      } as NavigatorScreenParams<MainTabParamList>
    );
    close();
  };

  const goMenuHome = () => {
    props.navigation.navigate("Tabs", {
      screen: "Menu",
      params: { screen: "MenuHome" },
    } as NavigatorScreenParams<MainTabParamList>);
    close();
  };

  const displayName =
    (user?.fullname as string) ||
    (user?.fullName as string) ||
    (user?.name as string) ||
    (user?.email as string) ||
    "";

  const onLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: Math.max(insets.top, space.md), paddingBottom: insets.bottom + space.md },
      ]}
      style={styles.scroll}
    >
      <View style={styles.brandBlock}>
        <Text style={styles.brandTitle}>NetQwix</Text>
        <Text style={styles.brandSub}>Dashboard</Text>
        {!!displayName && <Text style={styles.userLine} numberOfLines={1}>{displayName}</Text>}
      </View>

      <Text style={styles.sectionTitle}>Main</Text>
      {primaryItems.map((row) => {
        const active = focusedTab === row.tab;
        return (
          <Pressable
            key={row.tab}
            style={({ pressed }) => [
              styles.row,
              active && styles.rowActive,
              pressed && styles.rowPressed,
            ]}
            onPress={() => goTab(row.tab)}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Ionicons
                name={row.icon}
                size={22}
                color={active ? colors.sidebarActive : colors.textSecondary}
              />
            </View>
            <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{row.label}</Text>
          </Pressable>
        );
      })}

      <Text style={styles.sectionTitle}>Pages</Text>
      {secondaryRoutes.map((r: DashboardRouteMeta) => {
        if (r.id === "instant-booking") {
          return (
            <Pressable
              key={r.id}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => goTab("Home")}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={featureIcon(r.id)} size={22} color={colors.textSecondary} />
              </View>
              <Text style={styles.rowLabel}>{r.title}</Text>
            </Pressable>
          );
        }
        return (
          <Pressable
            key={r.id}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => goFeature(r.id)}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={featureIcon(r.id)} size={22} color={colors.textSecondary} />
            </View>
            <Text style={styles.rowLabel}>{r.title}</Text>
          </Pressable>
        );
      })}

      <Text style={styles.sectionTitle}>Tools</Text>
      {shellUtilities.map((s) => (
        <Pressable
          key={s.id}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => goShell(s.id)}
        >
          <View style={styles.iconWrap}>
            <Ionicons name={shellIcon(s.id)} size={22} color={colors.textSecondary} />
          </View>
          <Text style={styles.rowLabel}>{s.title}</Text>
        </Pressable>
      ))}

      <View style={styles.spacer} />

      <View style={styles.footer}>
        <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={goMenuHome}>
          <View style={styles.iconWrap}>
            <Ionicons name="grid-outline" size={22} color={colors.textSecondary} />
          </View>
          <Text style={styles.rowLabel}>Full menu</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onLogout}>
          <View style={styles.iconWrap}>
            <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          </View>
          <Text style={[styles.rowLabel, { color: colors.danger }]}>Sign out</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  brandBlock: {
    paddingHorizontal: space.md,
    paddingBottom: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: space.sm,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.brandNavy,
    letterSpacing: -0.5,
  },
  brandSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: "600" },
  userLine: { fontSize: 13, color: colors.textSecondary, marginTop: space.sm },
  sectionTitle: {
    marginTop: space.md,
    marginBottom: space.xs,
    marginHorizontal: space.md,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: space.md,
    marginHorizontal: space.sm,
    borderRadius: radii.md,
    gap: space.sm,
  },
  rowPressed: { opacity: 0.85 },
  rowActive: { backgroundColor: colors.sidebarActiveBg },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: { backgroundColor: colors.sidebarActiveBg },
  rowLabel: { flex: 1, fontSize: 15, color: colors.text, fontWeight: "500" },
  rowLabelActive: { color: colors.sidebarActive, fontWeight: "700" },
  spacer: { flexGrow: 1, minHeight: space.md },
  footer: {
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
