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
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Button,
  Card,
  InlineSavedIndicator,
  LanguagePickerModal,
  ListRow,
  Pill,
  ScreenContainer,
  SectionHeader,
  SettingsSectionSkeleton,
  SkeletonGroup,
  TimeZoneSearchModal,
} from "../../../components/ui";
import { useInlineSaved } from "../../../lib/forms/useInlineSaved";
import { DEVDUDES_LABEL, DEVDUDES_URL, WEB_APP_ORIGIN } from "../../../config/env";
import { AccountType } from "../../../constants/accountType";
import { WebRoutes } from "../../../constants/webRoutes";
import type { MenuStackParamList, ShellSurfaceRouteId } from "../../../navigation/types";
import { space, typography, useThemeColors } from "../../../theme";
import { useTheme, type ThemeMode } from "../../../theme/ThemeContext";
import { areHapticsEnabled, haptics, setHapticsEnabled } from "../../../lib/haptics";
import { revokeAllAuthSessions } from "../../auth/api/authSessionsApi";
import { useAuth } from "../../auth/context/AuthContext";
import {
  biometricLabel,
  isAppUnlockEnabled,
  setAppUnlockEnabled,
} from "../../auth/security/appUnlock";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { runSystemStateAction } from "../../system-states/navigation/linkActions";
import {
  patchUserNotificationSettings,
  postAccountPrivacy,
  putProfile,
  type BookingReminderCadence,
  type UserNotificationPrefs,
} from "../../home/api/homeApi";
import { setReadReceiptsEnabled } from "../../chats/api/chatActionsApi";
import { requestPushPermissionForReason } from "../../notifications/pushTokens";
import i18n from "../../../i18n";
import { applyRtlLocale } from "../../../i18n/applyRtlLocale";
import { bcp47ForAppLocale, languageLabelForCode, normalizeAppLocale } from "../../../i18n/languages";
import { persistAppLocale } from "../../../i18n/localeStorage";
import {
  readProfileVisibility,
  updateProfileVisibility,
  type ProfileVisibility,
} from "../../settings/api/privacyApi";
import { OnboardingWalkthrough, resetCoachMarks } from "../../onboarding";
import { fuzzySearch } from "../../../lib/search/fuzzyMatch";
import { useDebouncedValue } from "../../../lib/search/useDebouncedValue";

const REMINDER_CADENCES: BookingReminderCadence[] = [
  "standard",
  "minimal",
  "aggressive",
  "off",
];

function readNotificationPrefs(user: Record<string, unknown> | null): UserNotificationPrefs {
  const n = (user?.notifications ?? {}) as Partial<UserNotificationPrefs>;
  const cadence = n.bookingReminderCadence;
  const validCadence = (
    cadence && REMINDER_CADENCES.includes(cadence as BookingReminderCadence)
      ? (cadence as BookingReminderCadence)
      : "standard"
  );
  return {
    promotional: {
      email: n.promotional?.email !== false,
      sms: n.promotional?.sms !== false,
    },
    transactional: {
      email: n.transactional?.email !== false,
      sms: n.transactional?.sms !== false,
    },
    bookingReminderCadence: validCadence,
  };
}

export function SettingsScreen() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();

  const defaultTz = "America/New_York";

  /**
   * Replay-tour state — when set, mounts {@link OnboardingWalkthrough} in
   * `forceOpen` mode (it normally suppresses itself for returning users).
   * Closing the modal resets this and also clears the coach-mark "seen"
   * map so the user can re-discover the in-place hints.
   */
  const [replayTourOpen, setReplayTourOpen] = useState(false);

  const openShell = useCallback(
    (id: ShellSurfaceRouteId) => {
      navigation.navigate("ShellSurface", { surfaceId: id });
    },
    [navigation]
  );

  const openDashboard = useCallback(
    (featureId: "contact-us" | "about-us" | "faq") => {
      navigation.navigate("DashboardFeature", { featureId });
    },
    [navigation]
  );

  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { user, accountType, signOut, patchUser } = useAuth();
  const name = (user?.fullname as string) || (user?.fullName as string) || t("settings.defaultUser");
  const email = (user?.email as string) ?? "";
  const isTrainer = accountType === AccountType.TRAINER;

  const [localeDraft, setLocaleDraft] = useState(() => normalizeAppLocale(i18n.language));
  const [tzDraft, setTzDraft] = useState(defaultTz);
  const [langOpen, setLangOpen] = useState(false);
  const [tzOpen, setTzOpen] = useState(false);
  const [regionalBusy, setRegionalBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loc =
      typeof user.preferred_locale === "string" && user.preferred_locale.trim()
        ? normalizeAppLocale(user.preferred_locale)
        : normalizeAppLocale(i18n.language);
    setLocaleDraft(loc);
    setTzDraft(
      typeof user.time_zone === "string" && user.time_zone.trim()
        ? (user.time_zone as string).trim()
        : defaultTz
    );
  }, [user]);

  const regionalDirty = useMemo(() => {
    const draftLoc = normalizeAppLocale(localeDraft);
    const savedLocStr =
      typeof user?.preferred_locale === "string" ? user.preferred_locale.trim() : "";
    const savedLoc = savedLocStr ? normalizeAppLocale(savedLocStr) : null;
    const locDiff =
      savedLoc !== null
        ? draftLoc !== savedLoc
        : draftLoc !== normalizeAppLocale(i18n.language);

    const savedTz = (
      typeof user?.time_zone === "string" && user.time_zone.trim()
        ? user.time_zone
        : defaultTz
    ).trim();
    const tzDiff = tzDraft.trim() !== savedTz;
    return locDiff || tzDiff;
  }, [user, localeDraft, tzDraft, i18n.language]);

  const saveRegional = async () => {
    if (!accountType) {
      Alert.alert(t("settings.regionalError"), t("settings.notSignedIn"));
      return;
    }
    const role = accountType === AccountType.TRAINER ? "Trainer" : "Trainee";
    setRegionalBusy(true);
    try {
      const nextLoc = normalizeAppLocale(localeDraft);
      const nextTz = tzDraft.trim() || defaultTz;
      const localeBcp47 = bcp47ForAppLocale(nextLoc);
      await putProfile(role, { preferred_locale: localeBcp47, time_zone: nextTz });
      await i18n.changeLanguage(nextLoc);
      await persistAppLocale(nextLoc);
      patchUser({ preferred_locale: localeBcp47, time_zone: nextTz });
      const needsRtlReload = applyRtlLocale(nextLoc);
      if (needsRtlReload) {
        Alert.alert(
          t("settings.regionalSaved"),
          t("settings.regionalRtlRestartBody")
        );
      } else {
        Alert.alert(t("settings.regionalSaved"), t("settings.regionalSavedBody"));
      }
    } catch (e) {
      Alert.alert(t("settings.regionalError"), getApiErrorMessage(e));
    } finally {
      setRegionalBusy(false);
    }
  };

  const [isPrivate, setIsPrivate] = useState(Boolean(user?.isPrivate));
  const [notif, setNotif] = useState<UserNotificationPrefs>(() => readNotificationPrefs(user));
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [readReceipts, setReadReceipts] = useState(
    (user as any)?.privacy?.read_receipts_enabled !== false
  );
  const [readReceiptsBusy, setReadReceiptsBusy] = useState(false);
  const [notifBusy, setNotifBusy] = useState<string | null>(null);
  const [appUnlockOn, setAppUnlockOn] = useState(false);
  const [unlockLabel, setUnlockLabel] = useState(() => t("settings.biometricsDefault"));
  const [visibility, setVisibility] = useState<ProfileVisibility>(() =>
    readProfileVisibility(user as Record<string, unknown> | null)
  );
  const [visibilityBusy, setVisibilityBusy] = useState<keyof ProfileVisibility | null>(null);
  const [settingsSearch, setSettingsSearch] = useState("");
  const debouncedSettingsSearch = useDebouncedValue(settingsSearch, 280);
  const [hapticsOn, setHapticsOn] = useState(areHapticsEnabled());

  useEffect(() => {
    void isAppUnlockEnabled().then(setAppUnlockOn);
    void biometricLabel().then(setUnlockLabel);
  }, []);

  useEffect(() => {
    setIsPrivate(Boolean(user?.isPrivate));
    setNotif(readNotificationPrefs(user));
    setVisibility(readProfileVisibility(user as Record<string, unknown> | null));
  }, [user]);

  /**
   * Tracks transient "Saved ✓" pills next to each toggle so the user
   * sees an in-place confirmation instead of a noisy toast every time
   * they flip a switch.
   */
  const saved = useInlineSaved();

  const handleVisibilityToggle = async (key: keyof ProfileVisibility, value: boolean) => {
    const prev = visibility;
    const next = { ...visibility, [key]: value };
    setVisibility(next);
    setVisibilityBusy(key);
    try {
      const result = await updateProfileVisibility({ [key]: value });
      const merged = { ...next, ...result };
      setVisibility(merged);
      patchUser({ privacy_visibility: merged } as Record<string, unknown>);
      saved.ping(`visibility.${key}`);
    } catch (e: any) {
      setVisibility(prev);
      saved.fail(`visibility.${key}`);
      Alert.alert(
        t("settings.privacyAlertTitle"),
        e?.message ?? t("settings.privacyUpdateError")
      );
    } finally {
      setVisibilityBusy(null);
    }
  };

  const openWeb = useCallback(async (path: string) => {
    const url = `${WEB_APP_ORIGIN.replace(/\/$/, "")}${path}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else Alert.alert(t("settings.linkOpenErrorTitle"), url);
  }, [t]);

  const handlePrivacy = async (next: boolean) => {
    setIsPrivate(next);
    setPrivacyBusy(true);
    try {
      await postAccountPrivacy(next);
      patchUser({ isPrivate: next });
      saved.ping("privateAccount");
    } catch (e: any) {
      setIsPrivate(!next);
      saved.fail("privateAccount");
      Alert.alert(
        t("settings.privacyAlertTitle"),
        e?.message ?? t("settings.privacyUpdateError")
      );
    } finally {
      setPrivacyBusy(false);
    }
  };

  const handleNotifToggle = async (
    category: "promotional" | "transactional",
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
      patchUser({ notifications: updated });
      saved.ping(`notif.${key}`);
    } catch (e: any) {
      setNotif(prev);
      saved.fail(`notif.${key}`);
      Alert.alert(
        t("settings.notificationsAlertTitle"),
        e?.message ?? t("settings.notificationsUpdateError")
      );
    } finally {
      setNotifBusy(null);
    }
  };

  const handleCadenceChange = async (cadence: BookingReminderCadence) => {
    if (notif.bookingReminderCadence === cadence) return;
    /**
     * Just-in-time push permission prompt: enabling reminders is a
     * direct opt-in to receiving pushes, so this is the right moment
     * to ask the OS for permission.
     */
    if (cadence !== "off" && notif.bookingReminderCadence === "off") {
      void requestPushPermissionForReason("booking_reminder");
    }
    const prev = notif;
    const updated: UserNotificationPrefs = { ...notif, bookingReminderCadence: cadence };
    setNotif(updated);
    setNotifBusy("cadence");
    try {
      await patchUserNotificationSettings(updated);
      patchUser({ notifications: updated });
    } catch (e: any) {
      setNotif(prev);
      Alert.alert(
        t("settings.notificationsAlertTitle"),
        e?.message ?? t("settings.notificationsUpdateError")
      );
    } finally {
      setNotifBusy(null);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t("auth.signOut"), t("auth.signOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("auth.signOut"),
        style: "destructive",
        onPress: () => signOut(),
      },
    ]);
  };

  const handleSignOutAll = () => {
    Alert.alert(t("auth.signOutAll"), t("auth.signOutAllConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("auth.signOutAll"),
        style: "destructive",
        onPress: async () => {
          try {
            await revokeAllAuthSessions();
          } catch (e) {
            Alert.alert(t("auth.signOutAll"), getApiErrorMessage(e, t("auth.signOutAll")));
          } finally {
            await signOut();
          }
        },
      },
    ]);
  };

  /**
   * Two-step confirmation — first a warning, then a final destructive
   * confirmation. We don't ask for typed-text confirmation here because the
   * sign-in-required flow already gates it, but the second alert is
   * intentionally explicit about consequences.
   */
  /**
   * Routes to the OTP-gated delete flow (Phase 2 item 15). The legacy
   * `requestAccountDeletion()` is left intact in `accountDeletionApi.ts`
   * for any tests / dev tools that still call it directly.
   */
  const handleDeleteAccount = () => {
    openShell("deleteAccount");
  };

  const handleHibernateAccount = () => {
    openShell("hibernateAccount");
  };

  const supportRows = useMemo(() => {
    const rows: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = [
      { icon: "mail-outline", label: t("settings.contactUs"), onPress: () => openDashboard("contact-us") },
      { icon: "help-circle-outline", label: t("settings.faq"), onPress: () => openDashboard("faq") },
      {
        icon: "information-circle-outline",
        label: t("settings.about"),
        onPress: () => openDashboard("about-us"),
      },
      {
        icon: "document-text-outline",
        label: t("settings.helpPolicies"),
        onPress: () => void openWeb(WebRoutes.dashboardContactUs),
      },
      {
        icon: "shield-checkmark-outline",
        label: t("settings.privacyPolicy"),
        onPress: () => void runSystemStateAction("open_privacy"),
      },
      {
        icon: "reader-outline",
        label: t("settings.termsConditions"),
        onPress: () => void runSystemStateAction("open_terms"),
      },
    ];
    if (isTrainer) {
      rows.push({
        icon: "card-outline",
        label: t("settings.trainerProfileBilling"),
        onPress: () => void openWeb(WebRoutes.dashboardHome),
      });
    }
    rows.push({
      icon: "person-add-outline",
      label: t("settings.inviteFriends"),
      onPress: () => openShell("invite"),
    });
    /**
     * Replay onboarding — runs the full modal tour again. Coach marks
     * fire automatically the first time the user lands on a screen, so
     * this is an opt-in for users who want the higher-level tour back.
     */
    rows.push({
      icon: "play-circle-outline",
      label: t("settings.replayTour", { defaultValue: "Replay onboarding tour" }),
      onPress: () => setReplayTourOpen(true),
    });
    return rows;
  }, [isTrainer, openWeb, openDashboard, openShell, t]);

  const searchableRows = useMemo(() => {
    const rows: Array<{
      key: string;
      icon: keyof typeof Ionicons.glyphMap;
      title: string;
      subtitle?: string;
      keywords?: string;
      interactive?: boolean;
      onPress: () => void;
    }> = [
      {
        key: "editProfile",
        icon: "create-outline",
        title: t("settings.editProfile"),
        subtitle: t("settings.name"),
        keywords: "profile bio photo username account",
        onPress: () => openShell("editProfile"),
      },
      {
        key: "appUnlock",
        icon: "finger-print-outline",
        title: t("settings.appUnlockTitle", { label: unlockLabel }),
        subtitle: t("settings.appUnlockSubtitle"),
        keywords: "face id fingerprint biometric unlock security",
        interactive: false,
        onPress: () => {}, // discoverability-only row
      },
      {
        key: "walletSecurity",
        icon: "wallet-outline",
        title: t("settings.walletSecurity"),
        keywords: "wallet pin security payment",
        onPress: () => navigation.navigate("ShellSurface", { surfaceId: "wallet" }),
      },
      {
        key: "activeSessions",
        icon: "laptop-outline",
        title: t("settings.activeSessions"),
        subtitle: t("settings.activeSessionsSubtitle"),
        keywords: "devices login sessions",
        onPress: () => navigation.navigate("ActiveSessions"),
      },
      {
        key: "notificationPreferences",
        icon: "notifications-circle-outline",
        title: t("settings.notificationPreferencesTitle", { defaultValue: "Notification preferences" }),
        subtitle: t("settings.notificationPreferencesHint", {
          defaultValue: "Categories, channels, mute, quiet hours",
        }),
        keywords: "notification reminders sms email push",
        onPress: () => navigation.navigate("NotificationPreferences" as never),
      },
      {
        key: "privateAccount",
        icon: "eye-off-outline",
        title: t("settings.privateAccount"),
        keywords: "privacy private profile",
        interactive: false,
        onPress: () => {},
      },
      {
        key: "blockedUsers",
        icon: "ban-outline",
        title: t("settings.blockedAccounts", { defaultValue: "Blocked accounts" }),
        subtitle: t("settings.blockedAccountsSubtitle", {
          defaultValue: "Review or unblock people you've blocked.",
        }),
        keywords: "block blocked users community safety",
        onPress: () => navigation.navigate("BlockedUsers" as never),
      },
      {
        key: "language",
        icon: "language-outline",
        title: t("settings.language"),
        subtitle: languageLabelForCode(localeDraft),
        keywords: "language locale regional",
        onPress: () => setLangOpen(true),
      },
      {
        key: "timezone",
        icon: "globe-outline",
        title: t("settings.timezone"),
        subtitle: tzDraft,
        keywords: "timezone region country time",
        onPress: () => setTzOpen(true),
      },
      {
        key: "contact",
        icon: "mail-outline",
        title: t("settings.contactUs"),
        keywords: "support help contact",
        onPress: () => openDashboard("contact-us"),
      },
      {
        key: "faq",
        icon: "help-circle-outline",
        title: t("settings.faq"),
        keywords: "faq help docs support",
        onPress: () => openDashboard("faq"),
      },
      {
        key: "delete",
        icon: "trash-outline",
        title: t("settings.deleteAccount"),
        subtitle: t("settings.deleteAccountSubtitle"),
        keywords: "delete account remove danger",
        onPress: handleDeleteAccount,
      },
    ];
    if (isTrainer) {
      rows.push({
        key: "schedule",
        icon: "calendar-outline",
        title: t("settings.mySchedule"),
        keywords: "trainer schedule availability slots",
        onPress: () => openShell("trainerSchedule"),
      });
      rows.push({
        key: "twoFactor",
        icon: "shield-checkmark-outline",
        title: t("settings.twoFactor", { defaultValue: "Two-factor authentication" }),
        subtitle: t("settings.twoFactorSubtitle", {
          defaultValue: "Extra OTP step for trainer accounts on new devices.",
        }),
        keywords: "2fa otp auth security trainer",
        onPress: () => navigation.navigate("TwoFactor" as never),
      });
    }
    return rows;
  }, [
    handleDeleteAccount,
    isTrainer,
    languageLabelForCode,
    localeDraft,
    navigation,
    openDashboard,
    openShell,
    t,
    tzDraft,
    unlockLabel,
  ]);

  const searchResults = useMemo(() => {
    const q = debouncedSettingsSearch.trim();
    if (!q) return [];
    return fuzzySearch(
      q,
      searchableRows.map((row) => ({
        item: row,
        fields: [row.title, row.subtitle ?? "", row.keywords ?? ""],
      })),
      { limit: 16, fieldWeights: [1, 0.9, 0.7] }
    ).map((hit) => hit.item);
  }, [searchableRows, debouncedSettingsSearch]);

  const suggestionRows = useMemo(() => searchResults.slice(0, 6), [searchResults]);

  if (!user) {
    return (
      <ScreenContainer scroll padding={0} background={c.surface} clearFloatingTabBar>
        <SkeletonGroup count={4} gap={0} renderRow={() => <SettingsSectionSkeleton rows={4} />} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll padding="md" background={c.surface} clearFloatingTabBar>
      <Pressable onPress={() => openShell("editProfile")}>
        <Card variant="outlined" padding="md" style={styles.profileCard}>
          <Avatar name={name} size="xl" user={user as Record<string, unknown>} />
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
            <Pill label={accountType ?? t("settings.member")} tone="brand" style={{ marginTop: 6 }} />
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
        </Card>
      </Pressable>

      <Card variant="outlined" padding="md" style={styles.searchCard}>
        <View style={[styles.searchInputWrap, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
          <Ionicons name="search-outline" size={18} color={c.textMuted} />
          <TextInput
            value={settingsSearch}
            onChangeText={setSettingsSearch}
            placeholder={t("settings.searchPlaceholder", {
              defaultValue: "Search settings, privacy, notifications, security...",
            })}
            placeholderTextColor={c.textMuted}
            style={[styles.searchInput, { color: c.text }]}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {settingsSearch ? (
            <Pressable
              onPress={() => setSettingsSearch("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("common.clear", { defaultValue: "Clear search" })}
            >
              <Ionicons name="close-circle" size={18} color={c.textMuted} />
            </Pressable>
          ) : null}
        </View>
        {settingsSearch ? (
          <Text style={[typography.caption, { color: c.textMuted, marginTop: 8 }]}>
            {searchResults.length > 0
              ? t("settings.searchResultsCount", {
                  defaultValue: "{{count}} results",
                  count: searchResults.length,
                })
              : t("settings.searchNoResults", {
                  defaultValue: "No matching settings. Try words like privacy, language, wallet, or notifications.",
                })}
          </Text>
        ) : null}
        {settingsSearch.trim().length > 0 && suggestionRows.length > 0 ? (
          <View style={styles.suggestionWrap}>
            {suggestionRows.map((row) => (
              <Pressable
                key={`suggest-${row.key}`}
                onPress={row.interactive === false ? undefined : row.onPress}
                style={({ pressed }) => [
                  styles.suggestionChip,
                  { borderColor: c.border, backgroundColor: c.surface },
                  pressed && row.interactive !== false && { opacity: 0.86 },
                ]}
                disabled={row.interactive === false}
              >
                <Ionicons name={row.icon} size={14} color={c.textMuted} />
                <Text
                  style={[typography.caption, { color: c.text, flexShrink: 1 }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {row.title}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Card>

      {settingsSearch.trim() ? (
        <Card variant="outlined" padding={0} style={styles.sectionCard}>
          {searchResults.map((row, idx) => (
            <React.Fragment key={row.key}>
              {idx > 0 ? <Divider /> : null}
              <ListRow
                icon={row.icon}
                title={row.title}
                subtitle={row.subtitle}
                onPress={row.onPress}
                hideChevron={row.interactive === false}
              />
            </React.Fragment>
          ))}
        </Card>
      ) : null}

      <SectionHeader label={t("settings.account")} />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        <ListRow
          icon="person-outline"
          title={t("settings.name")}
          subtitle={name}
          onPress={() => openShell("editProfile")}
        />
        <Divider />
        <ListRow icon="mail-outline" title={t("settings.email")} subtitle={email} hideChevron />
        <Divider />
        <ListRow
          icon="shield-outline"
          title={t("settings.accountType")}
          subtitle={accountType ?? ""}
          hideChevron
        />
        <Divider />
        <ListRow
          icon="create-outline"
          title={t("settings.editProfile")}
          onPress={() => openShell("editProfile")}
        />
        {isTrainer && (
          <>
            <Divider />
            <ListRow
              icon="calendar-outline"
              title={t("settings.mySchedule")}
              onPress={() => openShell("trainerSchedule")}
            />
            <Divider />
            <ListRow
              icon="pricetag-outline"
              title={t("settings.coachPromoCodes")}
              subtitle={t("settings.coachPromoCodesSubtitle")}
              onPress={() => openShell("trainerPromoCodes")}
            />
          </>
        )}
      </Card>

      <SectionHeader label={t("settings.appearance")} />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        {(
          [
            ["system", t("settings.themeMatchSystem"), "phone-portrait-outline"],
            ["light", t("settings.themeLight"), "sunny-outline"],
            ["dark", t("settings.themeDark"), "moon-outline"],
          ] as const
        ).map(([id, label, icon], i) => (
          <React.Fragment key={id}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              icon={icon}
              title={label}
              accessibilityLabel={t("settings.themeAccessibility", {
                label,
                selected: themeMode === id ? t("settings.themeSelectedSuffix") : "",
              })}
              rightAdornment={
                themeMode === id ? (
                  <Ionicons name="checkmark-circle" size={22} color={c.brandAccent} />
                ) : (
                  <Ionicons name="ellipse-outline" size={22} color={c.neutral300} />
                )
              }
              onPress={() => setThemeMode(id as ThemeMode)}
              haptic="select"
              hideChevron
            />
          </React.Fragment>
        ))}
        <Divider />
        <ListRow
          icon="phone-portrait-outline"
          title={t("settings.hapticFeedback")}
          subtitle={t("settings.hapticFeedbackSubtitle")}
          haptic="none"
          rightAdornment={
            <Switch
              value={hapticsOn}
              onValueChange={(v) => {
                setHapticsOn(v);
                setHapticsEnabled(v);
                if (v) haptics.tap();
              }}
              trackColor={{ false: c.neutral200, true: c.brandAccentSubtle }}
              thumbColor={hapticsOn ? c.brandAccent : c.neutral100}
              accessibilityLabel={t("settings.hapticFeedback")}
            />
          }
        />
      </Card>

      <SectionHeader label={t("settings.storage")} />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        <ListRow
          icon="cloud-outline"
          title={t("settings.storagePlan")}
          subtitle={t("settings.storagePlanSubtitle")}
          onPress={() => navigation.navigate("StoragePlan")}
        />
      </Card>

      <SectionHeader label={t("settings.regionalTitle")} />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        <ListRow
          icon="language-outline"
          title={t("settings.language")}
          subtitle={languageLabelForCode(localeDraft)}
          onPress={() => setLangOpen(true)}
        />
        <Divider />
        <ListRow
          icon="globe-outline"
          title={t("settings.timezone")}
          subtitle={tzDraft}
          onPress={() => setTzOpen(true)}
        />
        {regionalDirty ? (
          <>
            <Divider />
            <View style={{ padding: space.md }}>
              <Button
                label={t("settings.saveRegional")}
                leftIcon="save-outline"
                loading={regionalBusy}
                onPress={() => void saveRegional()}
              />
            </View>
          </>
        ) : null}
      </Card>

      <LanguagePickerModal
        visible={langOpen}
        selectedCode={localeDraft}
        onClose={() => setLangOpen(false)}
        onSelect={(code) => setLocaleDraft(normalizeAppLocale(code))}
      />
      <TimeZoneSearchModal
        visible={tzOpen}
        selectedId={tzDraft}
        onClose={() => setTzOpen(false)}
        onConfirm={(iana) => setTzDraft(iana)}
      />

      <SectionHeader label={t("settings.security")} />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        <ListRow
          icon="finger-print-outline"
          title={t("settings.appUnlockTitle", { label: unlockLabel })}
          subtitle={t("settings.appUnlockSubtitle")}
          rightAdornment={
            <Switch
              value={appUnlockOn}
              onValueChange={async (v) => {
                await setAppUnlockEnabled(v);
                setAppUnlockOn(v);
              }}
              trackColor={{ false: c.neutral200, true: c.brandAccentSubtle }}
              thumbColor={appUnlockOn ? c.brandAccent : c.neutral100}
              accessibilityLabel={t("settings.appUnlockTitle", { label: unlockLabel })}
            />
          }
        />
        <Divider />
        <ListRow
          icon="laptop-outline"
          title={t("settings.activeSessions")}
          subtitle={t("settings.activeSessionsSubtitle")}
          onPress={() => navigation.navigate("ActiveSessions")}
        />
        <Divider />
        <ListRow
          icon="wallet-outline"
          title={t("settings.walletSecurity")}
          onPress={() => navigation.navigate("ShellSurface", { surfaceId: "wallet" })}
        />
      </Card>

      <SectionHeader label={t("settings.privacy")} />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        <ListRow
          icon="eye-off-outline"
          title={t("settings.privateAccount")}
          rightAdornment={
            privacyBusy ? (
              <ActivityIndicator size="small" color={c.brandAccent} />
            ) : (
              <Switch
                value={isPrivate}
                onValueChange={handlePrivacy}
                trackColor={{ false: c.neutral200, true: c.brandAccentSubtle }}
                thumbColor={isPrivate ? c.brandAccent : c.neutral100}
                accessibilityLabel={t("settings.privateAccount")}
              />
            )
          }
        />
        <Divider />
        <ListRow
          icon="checkmark-done-outline"
          title={t("settings.readReceipts", { defaultValue: "Read receipts" })}
          subtitle={t("settings.readReceiptsHint", {
            defaultValue:
              "Show others a blue tick when you've read their messages.",
          })}
          rightAdornment={
            readReceiptsBusy ? (
              <ActivityIndicator size="small" color={c.brandAccent} />
            ) : (
              <Switch
                value={readReceipts}
                onValueChange={async (next) => {
                  setReadReceipts(next);
                  setReadReceiptsBusy(true);
                  try {
                    await setReadReceiptsEnabled(next);
                    patchUser({
                      privacy: {
                        ...((user as any)?.privacy ?? {}),
                        read_receipts_enabled: next,
                      },
                    } as any);
                  } catch {
                    setReadReceipts(!next);
                  } finally {
                    setReadReceiptsBusy(false);
                  }
                }}
                trackColor={{ false: c.neutral200, true: c.brandAccentSubtle }}
                thumbColor={readReceipts ? c.brandAccent : c.neutral100}
                accessibilityLabel={t("settings.readReceipts", { defaultValue: "Read receipts" })}
              />
            )
          }
        />
        <Divider />
        <ListRow
          icon="time-outline"
          title={t("settings.showLastActive", { defaultValue: "Show last active" })}
          subtitle={t("settings.showLastActiveHint", {
            defaultValue: "Let people see when you were last online.",
          })}
          rightAdornment={
            visibilityBusy === "show_last_active" ? (
              <ActivityIndicator size="small" color={c.brandAccent} />
            ) : (
              <View style={styles.rightAdornmentRow}>
                <InlineSavedIndicator
                  visible={saved.is("visibility.show_last_active")}
                  tone={saved.tone("visibility.show_last_active")}
                />
                <Switch
                  value={visibility.show_last_active}
                  onValueChange={(v) => void handleVisibilityToggle("show_last_active", v)}
                  trackColor={{ false: c.neutral200, true: c.brandAccentSubtle }}
                  thumbColor={visibility.show_last_active ? c.brandAccent : c.neutral100}
                  accessibilityLabel={t("settings.showLastActive", { defaultValue: "Show last active" })}
                />
              </View>
            )
          }
        />
        <Divider />
        <ListRow
          icon="radio-button-on-outline"
          title={t("settings.showOnlineStatus", { defaultValue: "Show online status" })}
          subtitle={t("settings.showOnlineStatusHint", {
            defaultValue: "Display the green presence dot to non-friends.",
          })}
          rightAdornment={
            visibilityBusy === "show_online_status" ? (
              <ActivityIndicator size="small" color={c.brandAccent} />
            ) : (
              <View style={styles.rightAdornmentRow}>
                <InlineSavedIndicator
                  visible={saved.is("visibility.show_online_status")}
                  tone={saved.tone("visibility.show_online_status")}
                />
                <Switch
                  value={visibility.show_online_status}
                  onValueChange={(v) => void handleVisibilityToggle("show_online_status", v)}
                  trackColor={{ false: c.neutral200, true: c.brandAccentSubtle }}
                  thumbColor={visibility.show_online_status ? c.brandAccent : c.neutral100}
                  accessibilityLabel={t("settings.showOnlineStatus", { defaultValue: "Show online status" })}
                />
              </View>
            )
          }
        />
        <Divider />
        <ListRow
          icon="search-outline"
          title={t("settings.showInCommunitySearch", {
            defaultValue: "Show in community search",
          })}
          subtitle={t("settings.showInCommunitySearchHint", {
            defaultValue: "Let other members find your profile via search.",
          })}
          rightAdornment={
            visibilityBusy === "show_in_community_search" ? (
              <ActivityIndicator size="small" color={c.brandAccent} />
            ) : (
              <View style={styles.rightAdornmentRow}>
                <InlineSavedIndicator
                  visible={saved.is("visibility.show_in_community_search")}
                  tone={saved.tone("visibility.show_in_community_search")}
                />
                <Switch
                  value={visibility.show_in_community_search}
                  onValueChange={(v) =>
                    void handleVisibilityToggle("show_in_community_search", v)
                  }
                  trackColor={{ false: c.neutral200, true: c.brandAccentSubtle }}
                  thumbColor={visibility.show_in_community_search ? c.brandAccent : c.neutral100}
                  accessibilityLabel={t("settings.showInCommunitySearch", {
                    defaultValue: "Show in community search",
                  })}
                />
              </View>
            )
          }
        />
        <Divider />
        <ListRow
          icon="chatbox-ellipses-outline"
          title={t("settings.allowMessageRequests", {
            defaultValue: "Allow message requests from non-friends",
          })}
          subtitle={t("settings.allowMessageRequestsHint", {
            defaultValue:
              "Off means only friends can DM you. Booked trainers can always reach you.",
          })}
          rightAdornment={
            visibilityBusy === "allow_message_requests_from_non_friends" ? (
              <ActivityIndicator size="small" color={c.brandAccent} />
            ) : (
              <View style={styles.rightAdornmentRow}>
                <InlineSavedIndicator
                  visible={saved.is("visibility.allow_message_requests_from_non_friends")}
                  tone={saved.tone("visibility.allow_message_requests_from_non_friends")}
                />
                <Switch
                  value={visibility.allow_message_requests_from_non_friends}
                  onValueChange={(v) =>
                    void handleVisibilityToggle(
                      "allow_message_requests_from_non_friends",
                      v
                    )
                  }
                  trackColor={{ false: c.neutral200, true: c.brandAccentSubtle }}
                  thumbColor={
                    visibility.allow_message_requests_from_non_friends
                      ? c.brandAccent
                      : c.neutral100
                  }
                  accessibilityLabel={t("settings.allowMessageRequests", {
                    defaultValue: "Allow message requests from non-friends",
                  })}
                />
              </View>
            )
          }
        />
        <Divider />
        <ListRow
          icon="ban-outline"
          title={t("settings.blockedAccounts", { defaultValue: "Blocked accounts" })}
          subtitle={t("settings.blockedAccountsSubtitle", {
            defaultValue: "Review or unblock people you've blocked.",
          })}
          onPress={() => navigation.navigate("BlockedUsers" as never)}
        />
        <Divider />
        <ListRow
          icon="cloud-download-outline"
          title={t("settings.exportMyData", { defaultValue: "Export my data" })}
          subtitle={t("settings.exportMyDataSubtitle", {
            defaultValue: "Download an archive of everything we hold (GDPR / DPDP).",
          })}
          onPress={() => navigation.navigate("DataExport" as never)}
        />
        {isTrainer ? (
          <>
            <Divider />
            <ListRow
              icon="shield-checkmark-outline"
              title={t("settings.twoFactor", { defaultValue: "Two-factor authentication" })}
              subtitle={t("settings.twoFactorSubtitle", {
                defaultValue: "Extra OTP step for trainer accounts on new devices.",
              })}
              onPress={() => navigation.navigate("TwoFactor" as never)}
            />
          </>
        ) : null}
      </Card>

      <SectionHeader
        label={t("settings.notificationsHeader", { defaultValue: "Notifications" })}
      />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        <ListRow
          icon="notifications-circle-outline"
          title={t("settings.notificationPreferencesTitle", {
            defaultValue: "Notification preferences",
          })}
          subtitle={t("settings.notificationPreferencesHint", {
            defaultValue: "Categories, channels, mute, quiet hours",
          })}
          onPress={() => navigation.navigate("NotificationPreferences" as never)}
        />
      </Card>

      <SectionHeader label={t("settings.bookingReminders")} />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        {REMINDER_CADENCES.map((cadence, i) => {
          const selected = notif.bookingReminderCadence === cadence;
          return (
            <React.Fragment key={cadence}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                icon={
                  cadence === "off"
                    ? "notifications-off-outline"
                    : cadence === "aggressive"
                    ? "alarm-outline"
                    : "notifications-outline"
                }
                title={t(`settings.reminderCadence.${cadence}.title`)}
                subtitle={t(`settings.reminderCadence.${cadence}.subtitle`)}
                rightAdornment={
                  notifBusy === "cadence" && selected ? (
                    <ActivityIndicator size="small" color={c.brandAccent} />
                  ) : selected ? (
                    <Ionicons name="checkmark-circle" size={22} color={c.brandAccent} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={22} color={c.neutral300} />
                  )
                }
                onPress={() => void handleCadenceChange(cadence)}
                hideChevron
              />
            </React.Fragment>
          );
        })}
      </Card>

      <SectionHeader label={t("settings.emailSmsPreferences")} />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        {(
          [
            ["promotional", "email", t("settings.promotionalEmail")],
            ["promotional", "sms", t("settings.promotionalSms")],
            ["transactional", "email", t("settings.transactionalEmail")],
            ["transactional", "sms", t("settings.transactionalSms")],
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

      <SectionHeader label={t("settings.supportInvites")} />
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
          title={t("settings.signOut")}
          destructive
          onPress={handleSignOut}
          hideChevron
        />
        <Divider />
        <ListRow
          icon="globe-outline"
          title={t("auth.signOutAll")}
          subtitle={t("settings.signOutAllSubtitle")}
          destructive
          onPress={handleSignOutAll}
          hideChevron
        />
      </Card>

      <SectionHeader label={t("settings.dangerZone")} />
      <Card variant="outlined" padding={0} style={styles.sectionCard}>
        <ListRow
          icon="moon-outline"
          title={t("settings.hibernateAccount", { defaultValue: "Pause my account" })}
          subtitle={t("settings.hibernateSubtitle", {
            defaultValue:
              "Hide your profile, pause messages and bookings. Come back anytime with a one-time code.",
          })}
          onPress={handleHibernateAccount}
        />
        <Divider />
        <ListRow
          icon="trash-outline"
          title={t("settings.deleteAccount")}
          subtitle={t("settings.deleteAccountSubtitle")}
          destructive
          onPress={handleDeleteAccount}
        />
      </Card>

      <Text
        style={{
          textAlign: "center",
          fontSize: 12,
          color: c.textMuted,
          paddingTop: space.sm,
        }}
      >
        {t("settings.footerVersion")}
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: space.md,
          paddingTop: 4,
        }}
        accessibilityRole="text"
        accessibilityLabel={t("settings.footerCreditA11y", {
          defaultValue: "Made with love by {{label}}",
          label: DEVDUDES_LABEL,
        })}
      >
        <Text style={{ fontSize: 12, color: c.textMuted }}>
          {t("settings.footerCreditPrefix", { defaultValue: "Made with " })}
        </Text>
        <Text style={{ fontSize: 12 }}>{"\u2764\uFE0F"}</Text>
        <Text style={{ fontSize: 12, color: c.textMuted }}>
          {t("settings.footerCreditBy", { defaultValue: " by " })}
        </Text>
        <Pressable
          onPress={() => {
            void Linking.openURL(DEVDUDES_URL).catch(() => {
              /* best-effort external link */
            });
          }}
          hitSlop={6}
          accessibilityRole="link"
          accessibilityLabel={DEVDUDES_LABEL}
        >
          <Text
            style={{
              fontSize: 12,
              color: c.brandNavy,
              fontWeight: "700",
              textDecorationLine: "underline",
            }}
          >
            {DEVDUDES_LABEL}
          </Text>
        </Pressable>
      </View>

      {/* Opt-in replay of the legacy modal tour. Coach marks remain the
          default first-run UX — this is for users who want the overview. */}
      {replayTourOpen ? (
        <OnboardingWalkthrough
          forceOpen
          onDismiss={() => {
            setReplayTourOpen(false);
            void resetCoachMarks();
          }}
        />
      ) : null}
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
  searchCard: { marginBottom: space.sm },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: space.sm,
    minHeight: 42,
  },
  searchInput: {
    flex: 1,
    ...typography.bodyMd,
    paddingVertical: 0,
  },
  suggestionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  /**
   * Inline confirmation pill sits next to the switch — this row keeps
   * them on the same horizontal axis without disturbing existing
   * adornment alignment on smaller phones.
   */
  rightAdornmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
});
