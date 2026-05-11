import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import { Screen } from "../../../components/ui/Screen";
import { colors, radii, space } from "../../../theme/tokens";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import type { MainTabScreenProps, ShellSurfaceRouteId } from "../../../navigation/types";
import {
  dashboardRoutesForRoles,
  HOME_QUICK_ROUTE_IDS,
  type DashboardRouteId,
  type DashboardRouteMeta,
} from "../config/dashboardRoutes";
import { shellSurfacesForRoles } from "../config/shellSurfaces";

export function DashboardHomeScreen({ navigation }: MainTabScreenProps<"Home">) {
  const { user, accountType } = useAuth();

  const name =
    (user?.fullname as string) ||
    (user?.fullName as string) ||
    (user?.name as string) ||
    (user?.email as string) ||
    "there";

  const allowed = useMemo(() => dashboardRoutesForRoles(accountType), [accountType]);
  const allowedIds = useMemo(() => new Set(allowed.map((r) => r.id)), [allowed]);

  const quickRoutes = useMemo(() => {
    const ids = HOME_QUICK_ROUTE_IDS.filter((id) => allowedIds.has(id));
    return ids
      .map((id) => allowed.find((r) => r.id === id))
      .filter((r): r is DashboardRouteMeta => r != null);
  }, [allowed, allowedIds]);

  const shellRail = useMemo(() => shellSurfacesForRoles(accountType), [accountType]);

  const openTab = (tab: "Schedule" | "Chats") => {
    navigation.navigate(tab);
  };

  const openFeature = (id: DashboardRouteId) => {
    navigation.navigate("Menu", { screen: "DashboardFeature", params: { featureId: id } });
  };

  const openShell = (surfaceId: ShellSurfaceRouteId) => {
    navigation.navigate("Menu", { screen: "ShellSurface", params: { surfaceId } });
  };

  const isTrainee = accountType === AccountType.TRAINEE;

  return (
    <Screen scroll>
      <View style={styles.brandRow}>
        <NetqwixLogo maxWidth={140} />
      </View>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.greeting}>Hello, {name}</Text>
      <Text style={styles.meta}>{accountType ?? "Member"}</Text>

      <Text style={styles.section}>My locker</Text>
      <Text style={styles.sectionHint}>
        Web: logo → `/dashboard/home` (`NavHomePage`). Use the actions below like the left sidebar.
      </Text>

      <Text style={styles.subSection}>Primary</Text>
      <View style={styles.ctaRow}>
        {isTrainee ? (
          <>
            <Pressable
              onPress={() => openFeature("upcoming-sessions")}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            >
              <Ionicons name="calendar-outline" size={26} color={colors.primary} />
              <Text style={styles.ctaText}>Sessions</Text>
            </Pressable>
            <Pressable
              onPress={() => openFeature("book-lesson")}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            >
              <Ionicons name="book-outline" size={26} color={colors.primary} />
              <Text style={styles.ctaText}>Book expert</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => openTab("Schedule")}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            >
              <Ionicons name="calendar-outline" size={26} color={colors.primary} />
              <Text style={styles.ctaText}>Schedule</Text>
            </Pressable>
            <Pressable
              onPress={() => openFeature("upcoming-sessions")}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            >
              <Ionicons name="time-outline" size={26} color={colors.primary} />
              <Text style={styles.ctaText}>Upcoming</Text>
            </Pressable>
          </>
        )}
      </View>
      <View style={styles.ctaRow}>
        <Pressable
          onPress={() => openTab("Chats")}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Ionicons name="chatbubbles-outline" size={26} color={colors.primary} />
          <Text style={styles.ctaText}>Chats</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("Menu", { screen: "MenuHome" })}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Ionicons name="menu-outline" size={26} color={colors.primary} />
          <Text style={styles.ctaText}>Full menu</Text>
        </Pressable>
      </View>

      <Text style={styles.subSection}>Sidebar tools</Text>
      <View style={styles.shellWrap}>
        {shellRail.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => openShell(s.id)}
            style={({ pressed }) => [styles.shellChip, pressed && styles.shellChipPressed]}
          >
            <Text style={styles.shellChipText} numberOfLines={2}>
              {s.title}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.section, styles.sectionSpaced]}>More shortcuts</Text>
      <Text style={styles.sectionHint}>Jump to the same areas as the web dashboard.</Text>

      {quickRoutes.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => openFeature(r.id)}
          style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
        >
          <Text style={styles.linkTitle}>{r.title}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      ))}

      <Pressable
        onPress={() => navigation.navigate("Menu", { screen: "MenuHome" })}
        style={({ pressed }) => [styles.allMenu, pressed && styles.allMenuPressed]}
      >
        <Text style={styles.allMenuText}>Browse all dashboard pages and tools</Text>
        <Ionicons name="list-outline" size={22} color={colors.primary} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    alignItems: "center",
    marginBottom: space.md,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  greeting: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginTop: space.sm,
  },
  meta: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: space.xs,
    marginBottom: space.lg,
  },
  section: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: space.xs,
  },
  sectionSpaced: {
    marginTop: space.lg,
  },
  subSection: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: space.sm,
  },
  sectionHint: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: space.md,
    lineHeight: 20,
  },
  ctaRow: {
    flexDirection: "row",
    gap: space.md,
    marginBottom: space.lg,
  },
  cta: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaPressed: {
    opacity: 0.9,
    backgroundColor: "#eef2ff",
  },
  ctaText: {
    marginTop: space.sm,
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  shellWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: space.lg,
    gap: space.sm,
  },
  shellChip: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: "47%",
    flexGrow: 1,
  },
  shellChipPressed: {
    backgroundColor: "#eef2ff",
  },
  shellChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  linkPressed: {
    backgroundColor: colors.surface,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  allMenu: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.lg,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  allMenuPressed: {
    opacity: 0.92,
  },
  allMenuText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
    flex: 1,
  },
});
