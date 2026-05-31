import { DrawerContentScrollView, type DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { localizedNavLabel } from "../i18n/navLabels";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NetqwixLogo } from "../components/brand/NetqwixLogo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { layout, radii, space, typography, useThemeColors } from "../theme";
import { useAuth } from "../features/auth/context/AuthContext";
import { useGuestMode } from "../features/auth/hooks/useGuestMode";
import { useRequireAuth } from "../features/auth/hooks/useRequireAuth";
import type { MainTabParamList } from "./types";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { navMatrixFor, type NavMatrixEntry } from "./navMatrix";
import { getActiveNavState, isNavEntryActive } from "./activeNavState";

/** Wordmark uses full drawer width minus horizontal padding (drawer is 300px). */
const DRAWER_LOGO_HORIZONTAL_PAD = space.md;
const DRAWER_LOGO_MAX_WIDTH = layout.drawerWidth - DRAWER_LOGO_HORIZONTAL_PAD * 2;
const DRAWER_LOGO_HEIGHT = 80;
/** Cap status-bar inset so the drawer header does not sit too low on notched iPhones. */
const DRAWER_TOP_INSET_CAP = 14;

export function DashboardDrawerContent(props: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isGuest = useGuestMode();
  const { accountType, signOut } = useAuth();
  const { openAuth } = useRequireAuth();

  const drawerEntries = useMemo(
    () => navMatrixFor("drawer", accountType, undefined, { guest: isGuest }),
    [accountType, isGuest]
  );

  const activeNav = useMemo(
    () => getActiveNavState(props.state),
    [props.state]
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
      if (target.tab === "Home") {
        props.navigation.navigate("Tabs", {
          screen: "Home",
          params: { screen: "DashboardHome" },
        } as NavigatorScreenParams<MainTabParamList>);
      } else {
        goTab(target.tab);
      }
      return;
    }
    if (target.kind === "feature") {
      props.navigation.navigate("Tabs", {
        screen: "Home",
        params: {
          screen: "DashboardFeature",
          params: { featureId: target.featureId },
        },
      } as NavigatorScreenParams<MainTabParamList>);
    } else if (target.kind === "shell") {
      props.navigation.navigate("Tabs", {
        screen: "Home",
        params: {
          screen: "ShellSurface",
          params: { surfaceId: target.surfaceId },
        },
      } as NavigatorScreenParams<MainTabParamList>);
    }
    close();
  };

  const onLogout = () => {
    Alert.alert(t("auth.signOut"), t("auth.signOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("auth.signOut"), style: "destructive", onPress: () => void signOut() },
    ]);
  };

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: Math.min(insets.top, DRAWER_TOP_INSET_CAP) + space.xs,
          paddingBottom: insets.bottom + space.sm,
        },
      ]}
      style={[styles.scroll, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.brandBlock,
          { borderBottomColor: colors.border, backgroundColor: "#000000" },
        ]}
      >
        <View style={styles.brandLogoFrame}>
          <NetqwixLogo
            variant="wordmark"
            fullWidth
            maxWidth={DRAWER_LOGO_MAX_WIDTH}
            height={DRAWER_LOGO_HEIGHT}
            compact
            align="center"
          />
        </View>
      </View>

      <View style={styles.menuList}>
      {drawerEntries.map((entry) => {
        const active = isNavEntryActive(entry, activeNav);
        return (
          <Pressable
            key={entry.id}
            style={({ pressed }) => [
              styles.row,
              active && { backgroundColor: colors.sidebarActiveBg },
              pressed && !active && styles.rowPressed,
            ]}
            onPress={() => goEntry(entry)}
          >
            <View
              style={[
                styles.iconWrap,
                active && { backgroundColor: `${colors.sidebarActive}18` },
              ]}
            >
              <Ionicons
                name={entry.icon}
                size={22}
                color={active ? colors.sidebarActive : colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.rowLabel,
                { color: active ? colors.sidebarActive : colors.text },
                active && styles.rowLabelActive,
              ]}
            >
              {localizedNavLabel(t, entry)}
            </Text>
          </Pressable>
        );
      })}
      </View>

      <View style={styles.spacer} />

      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => {
          if (isGuest) {
            openAuth("Login");
            close();
            return;
          }
          onLogout();
        }}
      >
        <View style={styles.iconWrap}>
          <Ionicons
            name={isGuest ? "log-in-outline" : "log-out-outline"}
            size={22}
            color={isGuest ? colors.brandAccent : colors.danger}
          />
        </View>
        <Text
          style={[
            styles.rowLabel,
            { color: isGuest ? colors.brandAccent : colors.danger },
          ]}
        >
          {isGuest ? t("auth.signIn") : t("auth.signOutLower")}
        </Text>
      </Pressable>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  brandBlock: {
    paddingHorizontal: DRAWER_LOGO_HORIZONTAL_PAD,
    paddingTop: space.sm,
    paddingBottom: space.md,
    marginBottom: space.xs,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandLogoFrame: {
    width: "100%",
    maxWidth: DRAWER_LOGO_MAX_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  menuList: {
    marginTop: space.xs,
    paddingTop: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginHorizontal: space.sm,
    borderRadius: radii.md,
    gap: space.md,
  },
  rowPressed: { opacity: 0.75 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { ...typography.bodyMd, flex: 1 },
  rowLabelActive: { fontWeight: "700" },
  spacer: { flex: 1, minHeight: space.lg },
});
