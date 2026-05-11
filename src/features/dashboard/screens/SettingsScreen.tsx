import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, space } from "../../../theme/tokens";
import { useAuth } from "../../auth/context/AuthContext";

const NAVY = "#000080";

type SettingRow = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  action?: () => void;
  danger?: boolean;
};

export function SettingsScreen() {
  const { user, accountType, signOut } = useAuth();
  const name = (user?.fullname as string) || (user?.fullName as string) || "User";
  const email = (user?.email as string) ?? "";

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

  const sections: Array<{ title: string; rows: SettingRow[] }> = [
    {
      title: "Account",
      rows: [
        { icon: "person-outline", label: "Name", value: name },
        { icon: "mail-outline", label: "Email", value: email },
        { icon: "shield-outline", label: "Account Type", value: accountType ?? "" },
      ],
    },
    {
      title: "Notifications",
      rows: [
        { icon: "notifications-outline", label: "Push Notifications", value: "Enabled" },
        { icon: "mail-outline", label: "Email Alerts", value: "Enabled" },
      ],
    },
    {
      title: "Support",
      rows: [
        { icon: "help-circle-outline", label: "Help Center" },
        { icon: "document-text-outline", label: "Terms of Service" },
        { icon: "lock-closed-outline", label: "Privacy Policy" },
      ],
    },
    {
      title: "",
      rows: [
        {
          icon: "log-out-outline",
          label: "Sign Out",
          danger: true,
          action: handleSignOut,
        },
      ],
    },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Profile card */}
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

      {sections.map((section, si) => (
        <View key={si} style={styles.section}>
          {!!section.title && (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          <View style={styles.sectionCard}>
            {section.rows.map((row, ri) => (
              <Pressable
                key={ri}
                style={({ pressed }) => [
                  styles.row,
                  ri < section.rows.length - 1 && styles.rowBorder,
                  pressed && { backgroundColor: "#f9fafb" },
                ]}
                onPress={row.action}
                disabled={!row.action}
              >
                <View style={[styles.rowIcon, row.danger && styles.rowIconDanger]}>
                  <Ionicons
                    name={row.icon}
                    size={18}
                    color={row.danger ? "#dc2626" : NAVY}
                  />
                </View>
                <Text style={[styles.rowLabel, row.danger && styles.rowLabelDanger]}>
                  {row.label}
                </Text>
                <View style={styles.rowRight}>
                  {!!row.value && (
                    <Text style={styles.rowValue} numberOfLines={1}>{row.value}</Text>
                  )}
                  {!row.value && row.action && (
                    <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

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
  rowRight: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "40%" },
  rowValue: { fontSize: 13, color: "#9ca3af", textAlign: "right" },

  version: { textAlign: "center", fontSize: 12, color: "#9ca3af", paddingVertical: space.sm },
});
