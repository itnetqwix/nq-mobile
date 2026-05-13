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
import { colors, radii, space, typography } from "../theme";
import { useAuth } from "../features/auth/context/AuthContext";
import { AccountType } from "../constants/accountType";
import type { MainTabParamList } from "./types";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { navMatrixFor, type NavMatrixEntry } from "./navMatrix";

/**
 * Enterprise sidebar driven by `navMatrix.ts`. Three sections:
 *   1. Main — bottom-tab destinations (Home, Schedule/Sessions, Chats).
 *   2. Pages — dashboard surfaces (instant booking, students, friends, …).
 *   3. Tools — locker + utility surfaces (clips, transactions, …).
 *
 * Every entry has exactly one canonical target — no more "instant booking"
 * pointing two different places.
 */

const TAB_PRIMARY: { tab: keyof MainTabParamList; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { tab: "Home", label: "My Locker", icon: "home-outline" },
  { tab: "Schedule", label: "Schedule", icon: "calendar-outline" },
  { tab: "Chats", label: "Chats", icon: "chatbubbles-outline" },
];

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

  const dashboardEntries = useMemo(
    () => navMatrixFor("drawer", accountType, "dashboard"),
    [accountType]
  );
  const toolEntries = useMemo(
    () => navMatrixFor("drawer", accountType, "tools"),
    [accountType]
  );

  const focusedTab = getFocusedTabName(props.state);
  const close = () => props.navigation.closeDrawer();

  const goTab = (tab: keyof MainTabParamList) => {
    props.navigation.navigate(
      "Tabs",
      { screen: tab } as NavigatorScreenParams<MainTabParamList>
    );
    close();
  };

  const goEntry = (entry: NavMatrixEntry) => {
    const { target } = entry;
    if (target.kind === "tab") {
      goTab(target.tab);
      return;
    }
    if (target.kind === "feature") {
      props.navigation.navigate(
        "Tabs",
        {
          screen: "Menu",
          params: {
            screen: "DashboardFeature",
            params: { featureId: target.featureId },
          },
        } as NavigatorScreenParams<MainTabParamList>
      );
    } else if (target.kind === "shell") {
      props.navigation.navigate(
        "Tabs",
        {
          screen: "Menu",
          params: {
            screen: "ShellSurface",
            params: { surfaceId: target.surfaceId },
          },
        } as NavigatorScreenParams<MainTabParamList>
      );
    }
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

      {dashboardEntries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Pages</Text>
          {dashboardEntries.map((entry) => (
            <Pressable
              key={entry.id}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => goEntry(entry)}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={entry.icon} size={22} color={colors.textSecondary} />
              </View>
              <Text style={styles.rowLabel}>{entry.label}</Text>
            </Pressable>
          ))}
        </>
      )}

      {toolEntries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Tools</Text>
          {toolEntries.map((entry) => (
            <Pressable
              key={entry.id}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => goEntry(entry)}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={entry.icon} size={22} color={colors.textSecondary} />
              </View>
              <Text style={styles.rowLabel}>{entry.label}</Text>
            </Pressable>
          ))}
        </>
      )}

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
    ...typography.titleLg,
    color: colors.brandNavy,
  },
  brandSub: { ...typography.caption, color: colors.textMuted, marginTop: 2, fontWeight: "600" },
  userLine: { ...typography.bodySm, color: colors.textSecondary, marginTop: space.sm },
  sectionTitle: {
    ...typography.overline,
    marginTop: space.md,
    marginBottom: space.xs,
    marginHorizontal: space.md,
    color: colors.textMuted,
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
  rowLabel: { flex: 1, ...typography.subtitle, color: colors.text },
  rowLabelActive: { color: colors.sidebarActive, fontWeight: "700" },
  spacer: { flexGrow: 1, minHeight: space.md },
  footer: {
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
