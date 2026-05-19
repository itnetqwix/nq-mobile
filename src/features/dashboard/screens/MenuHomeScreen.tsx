import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { localizedNavLabel } from "../../../i18n/navLabels";
import {
  Avatar,
  Card,
  ListRow,
  Pill,
  ScreenContainer,
} from "../../../components/ui";
import {
  navMatrixFor,
  type NavMatrixEntry,
} from "../../../navigation/navMatrix";
import type { MenuStackParamList } from "../../../navigation/types";
import { colors, radii, space, typography } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";

/**
 * "More" surface — the second source of truth alongside the drawer. Both
 * surfaces are driven by `navMatrix.ts` so a destination NEVER appears twice
 * with two different targets again.
 */
export function MenuHomeScreen() {
  const { t } = useTranslation();
  const { user, accountType, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();

  const name =
    (user?.fullname as string) ||
    (user?.fullName as string) ||
    (user?.name as string) ||
    (user?.email as string) ||
    "Member";

  const dashboardEntries = useMemo(
    () => navMatrixFor("more", accountType, "dashboard"),
    [accountType]
  );
  const toolEntries = useMemo(
    () => navMatrixFor("more", accountType, "tools"),
    [accountType]
  );

  const goEntry = useCallback(
    (entry: NavMatrixEntry) => {
      const { target } = entry;
      if (target.kind === "feature") {
        navigation.navigate("DashboardFeature", { featureId: target.featureId });
      } else if (target.kind === "shell") {
        navigation.navigate("ShellSurface", { surfaceId: target.surfaceId });
      }
    },
    [navigation]
  );

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  const openSettings = () =>
    navigation.navigate("ShellSurface", { surfaceId: "settings" });

  return (
    <ScreenContainer scroll padding="md" background={colors.surface}>
      <Card variant="outlined" padding="md" style={styles.profileCard}>
        <Avatar name={name} size="lg" />
        <View style={styles.profileInfo}>
          <Text style={[typography.titleSm, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Pill label={accountType ?? "Member"} tone="brand" style={styles.rolePill} />
        </View>
        <Pressable
          onPress={openSettings}
          style={styles.settingsBtn}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
        </Pressable>
      </Card>

      {dashboardEntries.length > 0 && (
        <Card variant="outlined" padding={0} style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Dashboard</Text>
          {dashboardEntries.map((entry, idx) => (
            <View
              key={entry.id}
              style={idx > 0 ? styles.rowDivider : undefined}
            >
              <ListRow
                icon={entry.icon}
                title={localizedNavLabel(t, entry)}
                onPress={() => goEntry(entry)}
              />
            </View>
          ))}
        </Card>
      )}

      {toolEntries.length > 0 && (
        <Card variant="outlined" padding={0} style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Tools</Text>
          {toolEntries.map((entry, idx) => (
            <View
              key={entry.id}
              style={idx > 0 ? styles.rowDivider : undefined}
            >
              <ListRow
                icon={entry.icon}
                title={localizedNavLabel(t, entry)}
                onPress={() => goEntry(entry)}
              />
            </View>
          ))}
        </Card>
      )}

      <Pressable
        style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.8 }]}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginBottom: space.md,
  },
  profileInfo: { flex: 1 },
  rolePill: { marginTop: 6 },
  settingsBtn: { padding: 6 },

  sectionCard: { marginBottom: space.md },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    paddingVertical: 14,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.dangerSubtle,
  },
  logoutText: { fontSize: 15, fontWeight: "700", color: colors.danger },
});
