import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useMemo } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../../components/ui/Button";
import { Screen } from "../../../components/ui/Screen";
import { colors, radii, space } from "../../../theme/tokens";
import { useAuth } from "../../auth/context/AuthContext";
import type { MenuStackParamList, ShellSurfaceRouteId } from "../../../navigation/types";
import { dashboardRoutesForRoles, type DashboardRouteMeta } from "../config/dashboardRoutes";
import { shellSurfacesForRoles, type ShellSurfaceMeta } from "../config/shellSurfaces";

export function MenuHomeScreen() {
  const { user, accountType, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();

  const name =
    (user?.fullname as string) ||
    (user?.fullName as string) ||
    (user?.name as string) ||
    (user?.email as string) ||
    "Member";

  const dashboardPages = useMemo(() => dashboardRoutesForRoles(accountType), [accountType]);
  const shellItems = useMemo(() => shellSurfacesForRoles(accountType), [accountType]);

  const onOpenDashboard = (r: DashboardRouteMeta) => {
    navigation.navigate("DashboardFeature", { featureId: r.id });
  };

  const onOpenShell = (surfaceId: ShellSurfaceRouteId) => {
    navigation.navigate("ShellSurface", { surfaceId });
  };

  const onLogout = () => {
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Signed in</Text>
        <Text style={styles.heroName}>{name}</Text>
        <Text style={styles.heroMeta}>{accountType ?? "Member"}</Text>
      </View>

      <Text style={styles.section}>Toolbar</Text>
      <Text style={styles.sectionHint}>
        Same entries as the website left sidebar after “My Locker” (uploads, alerts, settings,
        wallet, meeting, messenger).
      </Text>

      {shellItems.map((s) => (
        <ShellRow key={s.id} meta={s} onPress={() => onOpenShell(s.id)} />
      ))}

      <Text style={[styles.section, styles.sectionSpaced]}>Dashboard pages</Text>
      <Text style={styles.sectionHint}>
        Same URLs as `pages/dashboard/*` in nq-frontend-main — native implementations follow.
      </Text>

      {dashboardPages.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => onOpenDashboard(r)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{r.title}</Text>
            <Text style={styles.rowSub} numberOfLines={2}>
              {r.subtitle}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      ))}

      <View style={styles.footer}>
        <Button title="Sign out" variant="ghost" onPress={onLogout} />
      </View>
    </Screen>
  );
}

function ShellRow({ meta, onPress }: { meta: ShellSurfaceMeta; onPress: () => void }) {
  const icon = shellIcon(meta.id);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Ionicons name={icon} size={22} color={colors.primary} style={styles.shellIcon} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{meta.title}</Text>
        <Text style={styles.rowSub} numberOfLines={2}>
          {meta.subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

function shellIcon(id: ShellSurfaceMeta["id"]): keyof typeof Ionicons.glyphMap {
  switch (id) {
    case "uploads":
      return "cloud-upload-outline";
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

const styles = StyleSheet.create({
  hero: {
    marginBottom: space.lg,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginTop: space.xs,
  },
  heroMeta: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: space.xs,
  },
  section: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: space.xs,
  },
  sectionSpaced: {
    marginTop: space.lg,
  },
  sectionHint: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: space.md,
    lineHeight: 20,
  },
  shellIcon: {
    marginRight: space.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  rowSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  footer: {
    marginTop: space.xl,
    marginBottom: space.lg,
  },
});
