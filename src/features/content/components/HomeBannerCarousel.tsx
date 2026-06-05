import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { ImageWithSkeleton } from "../../../components/ui";
import { type HomeBanner } from "../api/contentApi";
import { useCmsHome } from "../hooks/useCmsHome";
import { dismissedBanners } from "../dismissedBanners";
import { isReactNavigationDeepLink } from "../lib/deepLinks";
import { useContentWidth } from "../../../lib/layout";

type BannerCta = { label: string; url: string; variant?: string };

type Props = {
  guest?: boolean;
  onDeepLink?: (url: string) => void;
};

function severityPalette(
  c: ReturnType<typeof useThemeColors>,
  severity: HomeBanner["severity"]
) {
  switch (severity) {
    case "critical":
      return { bg: "#fdecea", fg: "#8a1c12", border: "#f5c6c2" };
    case "maintenance":
      return { bg: "#fff4e5", fg: "#7a4d00", border: "#ffe0b2" };
    case "success":
      return { bg: "#e6f6ee", fg: "#0e6b3e", border: "#b7e4c7" };
    case "promo":
      return { bg: c.brandAccentSubtle, fg: c.brandNavy, border: c.brandAccent };
    default:
      return { bg: c.surfaceElevated, fg: c.text, border: c.border };
  }
}

function resolveCtas(banner: HomeBanner): BannerCta[] {
  const multi = (banner as HomeBanner & { ctas?: BannerCta[] }).ctas;
  if (Array.isArray(multi) && multi.length > 0) return multi;
  if (banner.cta_label && banner.cta_url) {
    return [{ label: banner.cta_label, url: banner.cta_url, variant: "primary" }];
  }
  return [];
}

export function HomeBannerCarousel({ guest, onDeepLink }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const cardWidth = useContentWidth();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    void dismissedBanners.list().then((ids) => {
      if (mounted) setDismissedIds(ids);
    });
    const unsubscribe = dismissedBanners.subscribe(() => {
      void dismissedBanners.list().then((ids) => {
        if (mounted) setDismissedIds(ids);
      });
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const { data: bundle } = useCmsHome(guest, { refetchOnMount: "always" });

  const visible = useMemo(() => {
    const all = [
      ...(bundle?.banners.hero ?? []),
      ...(bundle?.banners.strip ?? []),
      ...(bundle?.banners.sticky_bottom ?? []),
    ];
    return all.filter((b) => !dismissedIds.includes(String(b._id)));
  }, [bundle, dismissedIds]);

  const openUrl = useCallback(
    (url: string) => {
      if (!url) return;
      if (isReactNavigationDeepLink(url) && onDeepLink) {
        onDeepLink(url);
        return;
      }
      Linking.openURL(url).catch(() => {});
    },
    [onDeepLink]
  );

  if (visible.length === 0) return null;

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardWidth + space.sm}
        contentContainerStyle={styles.scrollContent}
      >
        {visible.map((banner) => {
          const palette = severityPalette(c, banner.severity);
          const ctas = resolveCtas(banner);
          return (
            <View
              key={String(banner._id)}
              style={[
                styles.card,
                {
                  width: cardWidth,
                  backgroundColor: palette.bg,
                  borderColor: palette.border,
                },
              ]}
            >
              {banner.image_url ? (
                <ImageWithSkeleton
                  uri={banner.image_url}
                  width={cardWidth}
                  height={140}
                  borderRadius={0}
                />
              ) : null}
              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: palette.fg }]} numberOfLines={2}>
                    {banner.title}
                  </Text>
                  {banner.dismissible ? (
                    <Pressable
                      onPress={() => void dismissedBanners.dismiss(String(banner._id))}
                      hitSlop={10}
                      accessibilityLabel={t("homeBanner.dismissA11y", {
                        defaultValue: "Dismiss banner",
                      })}
                    >
                      <Ionicons name="close" size={18} color={palette.fg} />
                    </Pressable>
                  ) : null}
                </View>
                {banner.body ? (
                  <Text style={[styles.body, { color: palette.fg }]} numberOfLines={3}>
                    {banner.body}
                  </Text>
                ) : null}
                {ctas.length > 0 ? (
                  <View style={styles.ctaRow}>
                    {ctas.map((cta) => (
                      <Pressable
                        key={`${cta.label}-${cta.url}`}
                        onPress={() => openUrl(cta.url)}
                        style={({ pressed }) => [
                          styles.ctaBtn,
                          cta.variant === "secondary" && styles.ctaSecondary,
                          cta.variant === "ghost" && styles.ctaGhost,
                          pressed && { opacity: 0.88 },
                        ]}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.ctaLabel,
                            {
                              color:
                                cta.variant === "ghost" ? palette.fg : c.brandNavy,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {cta.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: space.sm },
  scrollContent: {
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: 140,
  },
  cardBody: {
    padding: space.md,
    gap: space.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
  },
  title: { ...typography.titleSm, flex: 1, fontWeight: "800" },
  body: { ...typography.bodySm, lineHeight: 20, opacity: 0.92 },
  ctaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.xs,
  },
  ctaBtn: {
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: "#ffffff",
    maxWidth: "100%",
  },
  ctaSecondary: {
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  ctaGhost: {
    backgroundColor: "transparent",
    paddingHorizontal: space.sm,
  },
  ctaLabel: { ...typography.label, fontWeight: "700" },
});
