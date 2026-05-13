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
import type { MainTabParamList } from "./types";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { navMatrixFor, type NavMatrixEntry } from "./navMatrix";

export function DashboardDrawerContent(props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { accountType, user, signOut } = useAuth();

  const drawerEntries = useMemo(
    () => navMatrixFor("drawer", accountType),
    [accountType]
  );

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

      {drawerEntries.map((entry) => (
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

      <View style={styles.spacer} />

      <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onLogout}>
        <View style={styles.iconWrap}>
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        </View>
        <Text style={[styles.rowLabel, { color: colors.danger }]}>Sign out</Text>
      </Pressable>
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
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, ...typography.subtitle, color: colors.text },
  spacer: { flexGrow: 1, minHeight: space.md },
});
