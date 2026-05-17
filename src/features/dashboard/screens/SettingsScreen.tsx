import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import {
  Avatar,
  Card,
  ListRow,
  Pill,
  ScreenContainer,
  SectionHeader,
} from "../../../components/ui";
import { WEB_APP_ORIGIN } from "../../../config/env";
import { AccountType } from "../../../constants/accountType";
import { WebRoutes } from "../../../constants/webRoutes";
import type { MenuStackParamList, ShellSurfaceRouteId } from "../../../navigation/types";
import { space, typography, useThemeColors } from "../../../theme";
import { useTheme, type ThemeMode } from "../../../theme/ThemeContext";
import { useAuth } from "../../auth/context/AuthContext";
import {
  biometricLabel,
  isAppUnlockEnabled,
  setAppUnlockEnabled,
} from "../../auth/security/appUnlock";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import {
  patchUserNotificationSettings,
  postAccountPrivacy,
  type UserNotificationPrefs,
} from "../../home/api/homeApi";

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

export function SettingsScreen() {
  const c = useThemeColors();
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

  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { user, accountType, signOut, refreshUser } = useAuth();
  const name = (user?.fullname as string) || (user?.fullName as string) || "User";
  const email = (user?.email as string) ?? "";
  const profileUri = getS3ImageUrl((user as any)?.profile_picture);
  const isTrainer = accountType === AccountType.TRAINER;

  const [isPrivate, setIsPrivate] = useState(Boolean(user?.isPrivate));
  const [notif, setNotif] = useState<UserNotificationPrefs>(() => readNotificationPrefs(user));
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [notifBusy, setNotifBusy] = useState<string | null>(null);
  const [appUnlockOn, setAppUnlockOn] = useState(false);
  const [unlockLabel, setUnlockLabel] = useState("Biometrics");

  useEffect(() => {
    void isAppUnlockEnabled().then(setAppUnlockOn);
    void biometricLabel().then(setUnlockLabel);
  }, []);

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

  const supportRows = useMemo(() => {
    const rows: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = [
      { icon: "mail-outline", label: "Contact us", onPress: () => openDashboard("contact-us") },
      {
        icon: "information-circle-outline",
        label: "About",
        onPress: () => void openWeb(WebRoutes.dashboardAboutUs),
      },
      {
        icon: "document-text-outline",
        label: "Help & policies",
        onPress: () => void openWeb(WebRoutes.dashboardContactUs),
      },
    ];
    if (isTrainer) {
      rows.push({
        icon: "card-outline",
        label: "Trainer profile & billing",
        onPress: () => void openWeb(WebRoutes.dashboardHome),
      });
    }
    rows.push({
      icon: "person-add-outline",
      label: "Invite friends",
      onPress: () => openShell("invite"),
    });
    return rows;
  }, [isTrainer, openWeb, openDashboard, openShell]);

  return (
    <ScreenContainer scroll padding="md" background={c.surface}>
      <Pressable onPress={() => openShell("editProfile")}>
        <Card variant="outlined" padding="md" style={styles.profileCard}>
          <Avatar name={name} size="xl" uri={profileUri} />
          <View style={{ flex: 1 }}>
            <Text style={[typography.titleMd, { color: c.text }]} numberOfLines={1}>
              {name}
            </Text>
            <Text
              style={[typography.bodySm, { color: c.textMuted, marginTop: 2 }]}
              numberOfLines={1}
            >
              {email}
            </Text>
            <Pill label={accountType ?? "Member"} tone="brand" style={{ marginTop: 6 }} />
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
        </Card>
      </Pressable>

      <SectionHeader label="Account" />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        <ListRow
          icon="person-outline"
          title="Name"
          subtitle={name}
          onPress={() => openShell("editProfile")}
        />
        <Divider />
        <ListRow icon="mail-outline" title="Email" subtitle={email} hideChevron />
        <Divider />
        <ListRow
          icon="shield-outline"
          title="Account type"
          subtitle={accountType ?? ""}
          hideChevron
        />
        <Divider />
        <ListRow
          icon="create-outline"
          title="Edit profile"
          onPress={() => openShell("editProfile")}
        />
        {isTrainer && (
          <>
            <Divider />
            <ListRow
              icon="calendar-outline"
              title="My schedule"
              onPress={() => openShell("trainerSchedule")}
            />
          </>
        )}
      </Card>

      <SectionHeader label="Appearance" />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        {(
          [
            ["system", "Match system", "phone-portrait-outline"],
            ["light", "Light mode", "sunny-outline"],
            ["dark", "Dark mode", "moon-outline"],
          ] as const
        ).map(([id, label, icon], i) => (
          <React.Fragment key={id}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              icon={icon}
              title={label}
              accessibilityLabel={`Theme: ${label}${themeMode === id ? " (selected)" : ""}`}
              rightAdornment={
                themeMode === id ? (
                  <Ionicons name="checkmark-circle" size={22} color={c.brandAccent} />
                ) : (
                  <Ionicons name="ellipse-outline" size={22} color={c.neutral300} />
                )
              }
              onPress={() => setThemeMode(id as ThemeMode)}
              hideChevron
            />
          </React.Fragment>
        ))}
      </Card>

      <SectionHeader label="Security" />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        <ListRow
          icon="finger-print-outline"
          title={`${unlockLabel} app unlock`}
          subtitle="Require biometrics when opening NetQwix"
          rightAdornment={
            <Switch
              value={appUnlockOn}
              onValueChange={async (v) => {
                await setAppUnlockEnabled(v);
                setAppUnlockOn(v);
              }}
              trackColor={{ false: c.neutral200, true: c.brandAccentSubtle }}
              thumbColor={appUnlockOn ? c.brandAccent : c.neutral100}
            />
          }
        />
        <Divider />
        <ListRow
          icon="laptop-outline"
          title="Active sessions"
          subtitle="Devices and browsers signed in to your account"
          onPress={() => navigation.navigate("ActiveSessions")}
        />
        <Divider />
        <ListRow
          icon="wallet-outline"
          title="Wallet security"
          onPress={() => navigation.navigate("ShellSurface", { surfaceId: "wallet" })}
        />
      </Card>

      <SectionHeader label="Privacy" />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        <ListRow
          icon="eye-off-outline"
          title="Private account"
          rightAdornment={
            privacyBusy ? (
              <ActivityIndicator size="small" color={c.brandAccent} />
            ) : (
              <Switch
                value={isPrivate}
                onValueChange={handlePrivacy}
                trackColor={{ false: c.neutral200, true: c.brandAccentSubtle }}
                thumbColor={isPrivate ? c.brandAccent : c.neutral100}
              />
            )
          }
        />
        {/* <Text style={styles.hint}>
          Matches the settings toggle.
        </Text> */}
      </Card>

      <SectionHeader label="Email & SMS preferences" />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
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
            <React.Fragment key={`${cat}-${ch}`}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                icon="notifications-outline"
                title={label}
                rightAdornment={
                  busy ? (
                    <ActivityIndicator size="small" color={c.brandAccent} />
                  ) : (
                    <Switch
                      value={on}
                      onValueChange={(v) => void handleNotifToggle(cat, ch, v)}
                      trackColor={{ false: c.neutral200, true: c.brandAccentSubtle }}
                      thumbColor={on ? c.brandAccent : c.neutral100}
                    />
                  )
                }
              />
            </React.Fragment>
          );
        })}
        {/* <Text style={styles.hint}>
          Same payload as the website (PATCH /user/update-notifications-settings with a full
          notifications object).
        </Text>  */}
      </Card>

      <SectionHeader label="Support & invites" />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        {supportRows.map((row, idx) => (
          <React.Fragment key={row.label}>
            {idx > 0 ? <Divider /> : null}
            <ListRow icon={row.icon} title={row.label} onPress={row.onPress} />
          </React.Fragment>
        ))}
      </Card>

      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        <ListRow
          icon="log-out-outline"
          title="Sign Out"
          destructive
          onPress={handleSignOut}
          hideChevron
        />
      </Card>

      <Text
        style={{
          textAlign: "center",
          fontSize: 12,
          color: c.textMuted,
          paddingVertical: space.sm,
        }}
      >
        NetQwix Mobile · v1.0.0
      </Text>
    </ScreenContainer>
  );
}

function Divider() {
  const c = useThemeColors();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: c.border,
        marginLeft: space.md + 36 + space.md,
      }}
    />
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  sectionCard: { marginBottom: space.sm },
});
