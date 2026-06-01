import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Constants from "expo-constants";
import React, { useCallback, useState } from "react";
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  Button,
  Card,
  LanguagePickerModal,
  ListRow,
  ScreenContainer,
  SectionHeader,
} from "../../../components/ui";
import { DEVDUDES_LABEL, DEVDUDES_URL } from "../../../config/env";
import i18n from "../../../i18n";
import { applyRtlLocale } from "../../../i18n/applyRtlLocale";
import { languageLabelForCode, normalizeAppLocale } from "../../../i18n/languages";
import { persistAppLocale } from "../../../i18n/localeStorage";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
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
  const [localeDraft, setLocaleDraft] = useState(() => normalizeAppLocale(i18n.language));
  const [langOpen, setLangOpen] = useState(false);
  const [replayIntroOpen, setReplayIntroOpen] = useState(false);

  const openDashboard = useCallback(
    (featureId: "contact-us" | "about-us" | "faq") => {
      navigation.navigate("DashboardFeature", { featureId });
    },
    [navigation]
  );

  const saveLocale = async (code: string) => {
    const nextLoc = normalizeAppLocale(code);
    setLocaleDraft(nextLoc);
    await i18n.changeLanguage(nextLoc);
    await persistAppLocale(nextLoc);
    const needsRtlReload = applyRtlLocale(nextLoc);
    if (needsRtlReload) {
      Alert.alert(
        t("guestSettings.languageSaved"),
        t("settings.regionalRtlRestartBody")
      );
    }
  };

  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "1.0.0";

  return (
    <ScreenContainer scroll padding="md">
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

      <SectionHeader label={t("settings.regionalTitle")} />
      <Card variant="outlined" padding={0}>
        <ListRow
          icon="language-outline"
          title={t("settings.language")}
          subtitle={languageLabelForCode(localeDraft)}
          onPress={() => setLangOpen(true)}
        />
      </Card>

      <LanguagePickerModal
        visible={langOpen}
        selectedCode={localeDraft}
        onClose={() => setLangOpen(false)}
        onSelect={(code) => void saveLocale(code)}
      />

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
