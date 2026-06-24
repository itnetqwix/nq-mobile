import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Constants from "expo-constants";
import React, { useCallback, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  Button,
  Card,
  ListRow,
  ScreenContainer,
  SectionHeader,
} from "../../../components/ui";
import { DEVDUDES_LABEL, DEVDUDES_URL } from "../../../config/env";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { areHapticsEnabled, haptics, setHapticsEnabled } from "../../../lib/haptics";
import type { MenuStackParamList } from "../../../navigation/types";
import { space, typography, useThemeColors } from "../../../theme";
import { useTheme, type ThemeMode } from "../../../theme/ThemeContext";
import { useRequireAuth } from "../../auth/hooks/useRequireAuth";
import { IntroOnboardingScreen } from "../../intro-onboarding";
import { runSystemStateAction } from "../../system-states/navigation/linkActions";

function Divider() {
  const c = useThemeColors();
  return <View style={[styles.divider, { backgroundColor: c.border }]} />;
}

export function GuestSettingsScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();
  const { openAuth } = useRequireAuth();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const [replayIntroOpen, setReplayIntroOpen] = useState(false);
  const [hapticsOn, setHapticsOn] = useState(areHapticsEnabled());

  const openDashboard = useCallback(
    (featureId: "contact-us" | "about-us" | "faq") => {
      navigation.navigate("DashboardFeature", { featureId });
    },
    [navigation]
  );

  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "1.0.0";

  return (
    <ScreenContainer scroll padding="md" clearFloatingTabBar>
      <Card
        variant="outlined"
        padding="md"
        style={{
          ...styles.guestBanner,
          borderColor: c.brandAccent,
          backgroundColor: c.brandAccentSubtle,
        }}
      >
        <View style={styles.guestBannerRow}>
          <Ionicons name="person-circle-outline" size={40} color={c.brandAccent} />
          <View style={styles.guestBannerCopy}>
            <Text style={[styles.guestBannerTitle, { color: c.brandNavy }]}>
              {t("guestSettings.bannerTitle")}
            </Text>
            <Text style={[styles.guestBannerBody, { color: c.textMuted }]}>
              {t("guestSettings.bannerBody")}
            </Text>
          </View>
        </View>
        <View style={styles.authCtas}>
          <Button
            label={t("auth.signIn")}
            size="md"
            onPress={() => openAuth("Login")}
          />
          <Button
            label={t("auth.createAccount")}
            variant="secondary"
            size="md"
            onPress={() => openAuth("SignUp")}
          />
        </View>
      </Card>

      <SectionHeader label={t("settings.appearance")} />
      <Card variant="outlined" padding={0}>
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
              haptic="select"
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

      <SectionHeader label={t("guestSettings.supportSection")} />
      <Card variant="outlined" padding={0}>
        <ListRow
          icon="mail-outline"
          title={t("settings.contactUs")}
          onPress={() => openDashboard("contact-us")}
        />
        <Divider />
        <ListRow
          icon="information-circle-outline"
          title={t("nav.aboutUs")}
          onPress={() => openDashboard("about-us")}
        />
        <Divider />
        <ListRow
          icon="help-circle-outline"
          title={t("settings.faq")}
          onPress={() => openDashboard("faq")}
        />
        <Divider />
        <ListRow
          icon="shield-checkmark-outline"
          title={t("settings.privacyPolicy")}
          onPress={() =>
            navigation.navigate("LegalDocument", { slug: "privacy" })
          }
        />
        <Divider />
        <ListRow
          icon="reader-outline"
          title={t("settings.termsConditions")}
          onPress={() => navigation.navigate("LegalDocument", { slug: "terms" })}
        />
        <Divider />
        <ListRow
          icon="calendar-outline"
          title={t("settings.cancellationPolicy")}
          onPress={() =>
            navigation.navigate("LegalDocument", { slug: "cancellation" })
          }
        />
        <Divider />
        <ListRow
          icon="cash-outline"
          title={t("settings.refundPolicy")}
          onPress={() => navigation.navigate("LegalDocument", { slug: "refund" })}
        />
        <Divider />
        <ListRow
          icon="newspaper-outline"
          title={t("cms.blogsTitle")}
          onPress={() => navigation.navigate("Blogs")}
        />
        <Divider />
        <ListRow
          icon="play-circle-outline"
          title={t("guestSettings.replayIntro")}
          onPress={() => setReplayIntroOpen(true)}
        />
      </Card>

      <Text style={[styles.version, { color: c.textMuted }]}>
        {t("guestSettings.version", { version: appVersion })}
      </Text>
      <View style={styles.footerCredit}>
        <Text style={[styles.credit, { color: c.textMuted }]}>
          {t("settings.footerCreditPrefix", { defaultValue: "Made with " })}
        </Text>
        <Pressable
          onPress={() => {
            void Linking.openURL(DEVDUDES_URL).catch(() => {});
          }}
          hitSlop={6}
          accessibilityRole="link"
          accessibilityLabel={DEVDUDES_LABEL}
        >
          <Text style={[styles.creditLink, { color: c.brandNavy }]}>{DEVDUDES_LABEL}</Text>
        </Pressable>
      </View>

      <Modal visible={replayIntroOpen} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaProvider>
          <IntroOnboardingScreen
            persistOnSkip={false}
            onGetStarted={() => {
              setReplayIntroOpen(false);
              openAuth("Login");
            }}
          />
        </SafeAreaProvider>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  guestBanner: { marginBottom: space.md },
  guestBannerRow: { flexDirection: "row", gap: space.md, marginBottom: space.md },
  guestBannerCopy: { flex: 1, gap: 4 },
  guestBannerTitle: { ...typography.titleSm, fontWeight: "800" },
  guestBannerBody: { ...typography.bodySm, lineHeight: 20 },
  authCtas: { gap: space.sm },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  version: { ...typography.caption, textAlign: "center", marginTop: space.xl },
  footerCredit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.xs,
    gap: 2,
  },
  credit: { ...typography.caption },
  creditLink: { ...typography.caption, fontWeight: "700", textDecorationLine: "underline" },
});
