import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, space } from "../../../theme/tokens";
import { useAuth } from "../../auth/context/AuthContext";
import type { MenuStackParamList, ShellSurfaceRouteId } from "../../../navigation/types";
import { dashboardRoutesForRoles, type DashboardRouteId, type DashboardRouteMeta } from "../config/dashboardRoutes";
import { shellSurfacesForRoles, type ShellSurfaceMeta } from "../config/shellSurfaces";
import { AccountType } from "../../../constants/accountType";

function featureIcon(id: DashboardRouteId): keyof typeof Ionicons.glyphMap {
  switch (id) {
    case "instant-booking": return "flash-outline";
    case "schedule": return "calendar-outline";
    case "book-lesson": return "book-outline";
    case "chats": return "chatbubbles-outline";
    case "upcoming-sessions": return "time-outline";
    case "my-community": return "people-outline";
    case "contact-us": return "mail-outline";
    case "about-us": return "information-circle-outline";
    case "friends": return "person-add-outline";
    case "students": return "school-outline";
    case "meeting-room": return "videocam-outline";
    case "practice-session": return "fitness-outline";
    default: return "ellipse-outline";
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
    case "notifications": return "notifications-outline";
    case "settings": return "settings-outline";
    case "transactions": return "wallet-outline";
    case "meeting": return "videocam-outline";
    case "messenger": return "chatbubble-ellipses-outline";
    case "trainerSchedule": return "calendar-outline";
    case "editProfile": return "person-outline";
    case "reportIssue": return "alert-circle-outline";
    default: return "ellipse-outline";
  }
}

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
      onPress={onPress}
    >
      <View style={styles.menuIconBox}>
        <Ionicons name={icon} size={20} color={colors.brandNavy} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
    </Pressable>
  );
}

export function MenuHomeScreen() {
  const { user, accountType, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();
  const isTrainer = accountType === AccountType.TRAINER;

  const name =
    (user?.fullname as string) ||
    (user?.fullName as string) ||
    (user?.name as string) ||
    (user?.email as string) ||
    "Member";

  const dashboardPages = useMemo(() => dashboardRoutesForRoles(accountType), [accountType]);
  const shellItems = useMemo(() => shellSurfacesForRoles(accountType), [accountType]);

  const openDashboard = (id: DashboardRouteId) => {
    navigation.navigate("DashboardFeature", { featureId: id });
  };

  const openShell = (id: ShellSurfaceRouteId) => {
    navigation.navigate("ShellSurface", { surfaceId: id });
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(name[0] ?? "?").toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{name}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{accountType ?? "Member"}</Text>
          </View>
        </View>
        <Pressable onPress={() => openShell("settings")} style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={22} color="#6b7280" />
        </Pressable>
      </View>

      {/* Dashboard features — matches website sidebar + top-nav items */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Dashboard</Text>
        {dashboardPages.map((r) => (
          <MenuRow
            key={r.id}
            icon={featureIcon(r.id)}
            label={r.title}
            onPress={() => openDashboard(r.id)}
          />
        ))}
      </View>

      {/* Sidebar tools — Clips, game plans, saved lessons, notifications, … */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Tools</Text>
        {shellItems
          .filter((s) => s.id !== "meeting" && s.id !== "messenger")
          .map((s) => (
            <MenuRow
              key={s.id}
              icon={shellIcon(s.id)}
              label={s.title}
              onPress={() => openShell(s.id)}
            />
          ))}
      </View>

      {/* Sign out */}
      <Pressable
        style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.8 }]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color="#dc2626" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "700", color: "#fff" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: "700", color: "#111827" },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  roleText: { fontSize: 11, fontWeight: "700", color: colors.brandNavy },
  settingsBtn: { padding: 6 },

  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },

  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f3f4f6",
    gap: space.md,
  },
  menuRowPressed: { backgroundColor: "#f9fafb" },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f0f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: "#111827" },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: radii.md,
    paddingVertical: 14,
    gap: space.sm,
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  logoutText: { fontSize: 15, fontWeight: "700", color: "#dc2626" },
});
