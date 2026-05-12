import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { radii, space } from "../../../theme/tokens";
import { WEB_APP_ORIGIN } from "../../../config/env";
import { WebRoutes } from "../../../constants/webRoutes";
import { AccountType } from "../../../constants/accountType";
import type { MenuStackParamList, ShellSurfaceRouteId } from "../../../navigation/types";
import { useAuth } from "../../auth/context/AuthContext";
import {
  patchUserNotificationSettings,
  postAccountPrivacy,
  type UserNotificationPrefs,
} from "../../home/api/homeApi";

const NAVY = "#000080";

function readNotificationPrefs(user: Record<string, unknown> | null): UserNotificationPrefs {
  const n = (user?.notifications ?? {}) as Partial<UserNotificationPrefs>;
  return {
    promotional: {
      email: n.promotional?.email !== false,
      sms: n.promotional?.sms !== false,
    },
    transactional: {
      email: n.transactional?.email !== false,
      sms: n.transactional?.sms !== false,
    },
  };
}

type SettingRow = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  action?: () => void;
  danger?: boolean;
};

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();

  const openShell = useCallback(
    (id: ShellSurfaceRouteId) => {
      navigation.navigate("ShellSurface", { surfaceId: id });
    },
    [navigation]
  );

  const openDashboard = useCallback(
    (featureId: "contact-us" | "about-us") => {
      navigation.navigate("DashboardFeature", { featureId });
    },
    [navigation]
  );

  const { user, accountType, signOut, refreshUser } = useAuth();
  const name = (user?.fullname as string) || (user?.fullName as string) || "User";
  const email = (user?.email as string) ?? "";
  const isTrainer = accountType === AccountType.TRAINER;

  const [isPrivate, setIsPrivate] = useState(Boolean(user?.isPrivate));
  const [notif, setNotif] = useState<UserNotificationPrefs>(() => readNotificationPrefs(user));
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [notifBusy, setNotifBusy] = useState<string | null>(null);

  useEffect(() => {
    setIsPrivate(Boolean(user?.isPrivate));
    setNotif(readNotificationPrefs(user));
  }, [user]);

  const openWeb = useCallback(async (path: string) => {
    const url = `${WEB_APP_ORIGIN.replace(/\/$/, "")}${path}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else Alert.alert("Unable to open link", url);
  }, []);

  const handlePrivacy = async (next: boolean) => {
    setIsPrivate(next);
    setPrivacyBusy(true);
    try {
      await postAccountPrivacy(next);
      await refreshUser();
    } catch (e: any) {
      setIsPrivate(!next);
      Alert.alert("Privacy", e?.message ?? "Could not update private account setting.");
    } finally {
      setPrivacyBusy(false);
    }
  };

  const handleNotifToggle = async (
    category: keyof UserNotificationPrefs,
    channel: "email" | "sms",
    value: boolean
  ) => {
    const key = `${category}.${channel}`;
    const prev = notif;
    const updated: UserNotificationPrefs = {
      ...notif,
      [category]: { ...notif[category], [channel]: value },
    };
    setNotif(updated);
    setNotifBusy(key);
    try {
      await patchUserNotificationSettings(updated);
      await refreshUser();
    } catch (e: any) {
      setNotif(prev);
      Alert.alert("Notifications", e?.message ?? "Could not save notification preferences.");
    } finally {
      setNotifBusy(null);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => signOut(),
      },
    ]);
  };

  const accountRows: SettingRow[] = [
    { icon: "person-outline", label: "Name", value: name },
    { icon: "mail-outline", label: "Email", value: email },
    { icon: "shield-outline", label: "Account Type", value: accountType ?? "" },
  ];

  const supportRows: SettingRow[] = useMemo(() => {
    const rows: SettingRow[] = [
      {
        icon: "mail-outline",
        label: "Contact us",
        action: () => openDashboard("contact-us"),
      },
      {
        icon: "information-circle-outline",
        label: "About (website)",
        action: () => void openWeb(WebRoutes.dashboardAboutUs),
      },
      {
        icon: "document-text-outline",
        label: "Help & policies (website)",
        action: () => void openWeb(WebRoutes.dashboardContactUs),
      },
    ];
    if (isTrainer) {
      rows.push({
        icon: "card-outline",
        label: "Trainer profile & billing (website)",
        action: () => void openWeb(WebRoutes.dashboardHome),
      });
    }
    rows.push({
      icon: "person-add-outline",
      label: "Invite friends",
      action: () => openShell("invite"),
    });
    return rows;
  }, [isTrainer, openWeb, openDashboard, openShell]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitial}>{(name[0] ?? "?").toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.profileName}>{name}</Text>
          <Text style={styles.profileEmail}>{email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{accountType ?? "Member"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.sectionCard}>
          {accountRows.map((row, ri) => {
            const isEditable = row.label === "Name";
            return (
              <Pressable
                key={row.label}
                style={({ pressed }) => [
                  styles.row,
                  ri < accountRows.length - 1 && styles.rowBorder,
                  pressed && isEditable && { backgroundColor: "#f9fafb" },
                ]}
                onPress={isEditable ? () => openShell("editProfile") : undefined}
                disabled={!isEditable}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={row.icon} size={18} color={NAVY} />
                </View>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <View style={styles.rowRight}>
                  <Text style={styles.rowValue} numberOfLines={1}>
                    {row.value}
                  </Text>
                  {isEditable && (
                    <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                  )}
                </View>
              </Pressable>
            );
          })}
          <Pressable
            style={({ pressed }) => [
              styles.row,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#f3f4f6" },
              pressed && { backgroundColor: "#f9fafb" },
            ]}
            onPress={() => openShell("editProfile")}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="create-outline" size={18} color={NAVY} />
            </View>
            <Text style={styles.rowLabel}>Edit profile</Text>
            <View style={styles.rowRight}>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </View>
          </Pressable>
          {isTrainer && (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#f3f4f6" },
                pressed && { backgroundColor: "#f9fafb" },
              ]}
              onPress={() => openShell("trainerSchedule")}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="calendar-outline" size={18} color={NAVY} />
              </View>
              <Text style={styles.rowLabel}>My schedule</Text>
              <View style={styles.rowRight}>
                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
              </View>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.sectionCard}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="eye-off-outline" size={18} color={NAVY} />
            </View>
            <Text style={styles.rowLabel}>Private account</Text>
            <View style={styles.rowRight}>
              {privacyBusy ? (
                <ActivityIndicator size="small" color={NAVY} />
              ) : (
                <Switch
                  value={isPrivate}
                  onValueChange={handlePrivacy}
                  trackColor={{ false: "#e5e7eb", true: "#bfdbfe" }}
                  thumbColor={isPrivate ? NAVY : "#f4f4f5"}
                />
              )}
            </View>
          </View>
          <Text style={styles.hint}>
            Matches the website settings toggle (POST `/user/update-account-privacy`).
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Email & SMS preferences</Text>
        <View style={styles.sectionCard}>
          {(
            [
              ["promotional", "email", "Promotional email"],
              ["promotional", "sms", "Promotional SMS"],
              ["transactional", "email", "Transactional email"],
              ["transactional", "sms", "Transactional SMS"],
            ] as const
          ).map(([cat, ch, label], i) => {
            const busy = notifBusy === `${cat}.${ch}`;
            const on = notif[cat][ch];
            return (
              <View
                key={`${cat}-${ch}`}
                style={[styles.row, i < 3 && styles.rowBorder]}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="notifications-outline" size={18} color={NAVY} />
                </View>
                <Text style={styles.rowLabel}>{label}</Text>
                <View style={styles.rowRight}>
                  {busy ? (
                    <ActivityIndicator size="small" color={NAVY} />
                  ) : (
                    <Switch
                      value={on}
                      onValueChange={(v) => void handleNotifToggle(cat, ch, v)}
                      trackColor={{ false: "#e5e7eb", true: "#bfdbfe" }}
                      thumbColor={on ? NAVY : "#f4f4f5"}
                    />
                  )}
                </View>
              </View>
            );
          })}
          <Text style={styles.hint}>
            Same payload as the website (`PATCH /user/update-notifications-settings` with a full
            `notifications` object).
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support & invites</Text>
        <View style={styles.sectionCard}>
          {supportRows.map((row, ri) => (
            <Pressable
              key={row.label}
              style={({ pressed }) => [
                styles.row,
                ri < supportRows.length - 1 && styles.rowBorder,
                pressed && { backgroundColor: "#f9fafb" },
              ]}
              onPress={row.action}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={row.icon} size={18} color={NAVY} />
              </View>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <View style={styles.rowRight}>
                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} />
        <View style={styles.sectionCard}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: "#f9fafb" }]}
            onPress={handleSignOut}
          >
            <View style={[styles.rowIcon, styles.rowIconDanger]}>
              <Ionicons name="log-out-outline" size={18} color="#dc2626" />
            </View>
            <Text style={[styles.rowLabel, styles.rowLabelDanger]}>Sign Out</Text>
            <View style={styles.rowRight} />
          </Pressable>
        </View>
      </View>

      <Text style={styles.version}>NetQwix Mobile · v1.0.0</Text>
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
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: { fontSize: 26, fontWeight: "700", color: "#fff" },
  profileName: { fontSize: 18, fontWeight: "700", color: "#111827" },
  profileEmail: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  roleText: { fontSize: 11, fontWeight: "700", color: NAVY },

  section: {},
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    paddingBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: "#9ca3af",
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    lineHeight: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: 14,
    gap: space.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f4f6",
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#f0f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconDanger: { backgroundColor: "#fee2e2" },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "500", color: "#111827" },
  rowLabelDanger: { color: "#dc2626" },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "42%",
    minWidth: 44,
    justifyContent: "flex-end",
  },
  rowValue: { fontSize: 13, color: "#9ca3af", textAlign: "right" },

  version: { textAlign: "center", fontSize: 12, color: "#9ca3af", paddingVertical: space.sm },
});
