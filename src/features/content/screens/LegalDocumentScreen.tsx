import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer, ScreenLoadingState } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";
import type { AuthStackParamList, HomeStackParamList } from "../../../navigation/types";
import { space, useThemeColors } from "../../../theme";
import { fetchCmsLegal, type CmsLegalSlug } from "../api/cmsApi";
import {
  PRIVACY_POLICY_URL,
  TERMS_AND_CONDITIONS_URL,
} from "../../../constants/legalUrls";

type Props =
  | NativeStackScreenProps<HomeStackParamList, "LegalDocument">
  | NativeStackScreenProps<AuthStackParamList, "LegalDocument">;

function htmlShell(title: string, body: string, textColor: string) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{font-family:-apple-system,sans-serif;padding:16px 18px;color:${textColor};line-height:1.65;font-size:15px}
    h1{font-size:22px;margin:0 0 16px} h2{font-size:17px;margin:20px 0 8px} h3{font-size:15px;margin:16px 0 6px}
    p{margin:0 0 12px} ul,ol{margin:0 0 12px;padding-left:20px} li{margin-bottom:6px}
    a{color:#000080;text-decoration:underline}
  </style></head>
  <body><h1>${title}</h1>${body}</body></html>`;
}

export function LegalDocumentScreen({ route, navigation }: Props) {
  const slug = route.params.slug as CmsLegalSlug;
  const { t } = useAppTranslation();
  const c = useThemeColors();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.content.legal(slug),
    queryFn: () => fetchCmsLegal(slug),
    staleTime: 5 * 60_000,
  });

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: data?.title ?? (slug === "privacy" ? t("settings.privacyPolicy") : t("settings.termsConditions")),
    });
  }, [navigation, data?.title, slug, t]);

  const fallbackUrl =
    slug === "privacy" ? PRIVACY_POLICY_URL : TERMS_AND_CONDITIONS_URL;

  if (isLoading && !data) {
    return (
      <ScreenContainer scroll={false} padding="md">
        <ScreenLoadingState variant="fullscreen" message={t("splash.preparing", { defaultValue: "Loading" })} />
      </ScreenContainer>
    );
  }

  if (!data?.body_html) {
    return (
      <ScreenContainer scroll={false} padding={0}>
        <WebView source={{ uri: fallbackUrl }} style={styles.web} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false} padding={0}>
      <WebView
        source={{
          html: htmlShell(data.title, data.body_html, c.text),
        }}
        style={styles.web}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
});
