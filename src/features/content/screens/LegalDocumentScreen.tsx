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
import { buildLegalDocumentHtml } from "../legalDocumentHtml";
import {
  legalUrlForSlug,
  type LegalUrlSlug,
} from "../../../constants/legalUrls";

type Props =
  | NativeStackScreenProps<HomeStackParamList, "LegalDocument">
  | NativeStackScreenProps<AuthStackParamList, "LegalDocument">;

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
    const titleBySlug: Record<CmsLegalSlug, string> = {
      privacy: t("settings.privacyPolicy"),
      terms: t("settings.termsConditions"),
      cancellation: t("settings.cancellationPolicy"),
      refund: t("settings.refundPolicy"),
    };
    navigation.setOptions({
      title: data?.title ?? titleBySlug[slug],
    });
  }, [navigation, data?.title, slug, t]);

  const fallbackUrl = legalUrlForSlug(slug as LegalUrlSlug);

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
          html: buildLegalDocumentHtml({
            title: data.title,
            bodyHtml: data.body_html,
            textColor: c.text,
            mutedColor: c.textMuted,
            linkColor: c.brandNavy,
            bgColor: c.surface,
            version: data.version,
            publishedAt: data.published_at,
          }),
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
