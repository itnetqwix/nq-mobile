import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenLoadingState } from "../../../components/ui";
import { fetchCmsStaticPage } from "../../content/api/cmsApi";
import { queryKeys } from "../../../lib/queryKeys";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

const FEATURE_KEYS = [
  { icon: "videocam-outline" as const, key: "liveVideo" },
  { icon: "calendar-outline" as const, key: "scheduling" },
  { icon: "cloud-upload-outline" as const, key: "clips" },
  { icon: "people-outline" as const, key: "community" },
  { icon: "wallet-outline" as const, key: "payments" },
  { icon: "trophy-outline" as const, key: "progress" },
];

export function AboutUsScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const cmsQ = useQuery({
    queryKey: queryKeys.content.page("about-us", "page"),
    queryFn: () => fetchCmsStaticPage("about-us"),
    staleTime: 5 * 60_000,
  });
  const styles = useStyles();

  if (cmsQ.isLoading) {
    return <ScreenLoadingState variant="fullscreen" message={t("splash.preparing", { defaultValue: "Loading" })} />;
  }

  if (cmsQ.data?.body_html) {
    const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>body{font-family:-apple-system,sans-serif;padding:16px;line-height:1.6;color:${c.text}}
      h1,h2,h3{color:${c.text}} p{margin:0 0 12px}</style></head>
      <body><h1>${cmsQ.data.title}</h1>${cmsQ.data.body_html}</body></html>`;
    return <WebView source={{ html }} style={{ flex: 1, backgroundColor: c.background }} />;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>NetQwix</Text>
        </View>
        <Text style={styles.tagline}>{t("about.tagline")}</Text>
        <Text style={styles.description}>{t("about.description")}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("about.whatWeOffer")}</Text>
        {FEATURE_KEYS.map((feature) => (
          <View key={feature.key} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={feature.icon} size={22} color={c.iconPrimary} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>
                {t(`about.features.${feature.key}.title`)}
              </Text>
              <Text style={styles.featureDesc}>
                {t(`about.features.${feature.key}.desc`)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("about.howItWorks")}</Text>
        <Text style={styles.description}>{t("about.howItWorksBody")}</Text>
      </View>

      <View style={styles.missionCard}>
        <Text style={styles.missionTitle}>{t("about.missionTitle")}</Text>
        <Text style={styles.missionText}>{t("about.missionText")}</Text>
      </View>

      <View style={styles.versionCard}>
        <Text style={styles.versionText}>{t("about.mobileApp")}</Text>
        <Text style={styles.versionSub}>{t("about.copyright")}</Text>
      </View>
    </ScrollView>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: palette.background },
      content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
      hero: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        padding: space.lg,
        alignItems: "center",
        gap: space.sm,
        borderWidth: 1,
        borderColor: palette.border,
      },
      logoBox: {
        backgroundColor: palette.brandNavy,
        borderRadius: radii.sm,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        marginBottom: space.xs,
      },
      logoText: { fontSize: 22, fontWeight: "800", color: palette.brandTextOn, letterSpacing: 1 },
      tagline: { ...typography.titleSm, color: palette.iconPrimary, textAlign: "center" },
      description: { ...typography.bodyMd, color: palette.textMuted, textAlign: "center" },
      section: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        padding: space.md,
        borderWidth: 1,
        borderColor: palette.border,
      },
      sectionTitle: { ...typography.titleSm, color: palette.text, marginBottom: space.md },
      featureRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.md,
        paddingVertical: space.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      featureIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: palette.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      },
      featureText: { flex: 1 },
      featureTitle: { ...typography.subtitle, color: palette.text },
      featureDesc: { ...typography.bodySm, color: palette.textMuted, marginTop: 2 },
      missionCard: {
        backgroundColor: palette.brandNavy,
        borderRadius: radii.md,
        padding: space.lg,
        gap: space.sm,
      },
      missionTitle: { ...typography.titleSm, color: palette.brandTextOn },
      missionText: { ...typography.bodyMd, color: palette.brandSubtle },
      versionCard: { alignItems: "center", paddingVertical: space.md, gap: 4 },
      versionText: { ...typography.bodySm, color: palette.textMuted },
      versionSub: { ...typography.caption, color: palette.textMuted },
    })
  );
}
