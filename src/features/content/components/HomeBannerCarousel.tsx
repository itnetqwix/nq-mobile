import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
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

function bannerImageHeight(banner: HomeBanner): number {
  const h = banner.image_height;
  if (typeof h === "number" && Number.isFinite(h)) {
    return Math.min(320, Math.max(64, Math.round(h)));
  }
  return 140;
}

function bannerOverlayOpacity(banner: HomeBanner): number {
  const o = banner.overlay_opacity;
  if (typeof o === "number" && Number.isFinite(o)) {
    return Math.min(1, Math.max(0, o));
  }
  return 0.45;
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
          const imageHeight = bannerImageHeight(banner);
          const imageFit = banner.image_fit === "contain" ? "contain" : "cover";
          const textAlign = banner.text_align === "center" ? "center" : "left";
          const overlay = bannerOverlayOpacity(banner);
          const hasBgImage = Boolean(banner.background_image_url);
          const cardBg =
            banner.background_color?.trim() ||
            (hasBgImage ? "#1a1a1a" : palette.bg);
          return (
            <View
              key={String(banner._id)}
              style={[
                styles.card,
                {
                  width: cardWidth,
                  backgroundColor: cardBg,
                  borderColor: palette.border,
                  minHeight:
                    hasBgImage && !banner.image_url ? imageHeight : undefined,
                },
              ]}
            >
              {hasBgImage ? (
                <>
                  <Image
                    source={{ uri: banner.background_image_url! }}
                    style={StyleSheet.absoluteFill}
                    contentFit={imageFit}
                  />
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: `rgba(0,0,0,${overlay})` },
                    ]}
                    pointerEvents="none"
                  />
                </>
              ) : null}
              {banner.image_url ? (
                <ImageWithSkeleton
                  uri={banner.image_url}
                  width={cardWidth}
                  height={imageHeight}
                  borderRadius={0}
                  resizeMode={imageFit}
                />
              ) : null}
              <View
                style={[
                  styles.cardBody,
                  hasBgImage && styles.cardBodyOverBg,
                  textAlign === "center" && styles.cardBodyCenter,
                ]}
              >
                <View style={[styles.titleRow, textAlign === "center" && styles.rowCenter]}>
                  <Text
                    style={[
                      styles.title,
                      { color: hasBgImage ? "#fff" : palette.fg, textAlign },
                    ]}
                    numberOfLines={2}
                  >
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
                      <Ionicons
                        name="close"
                        size={18}
                        color={hasBgImage ? "#fff" : palette.fg}
                      />
                    </Pressable>
                  ) : null}
                </View>
                {banner.body ? (
                  <Text
                    style={[
                      styles.body,
                      {
                        color: hasBgImage ? "rgba(255,255,255,0.92)" : palette.fg,
                        textAlign,
                      },
                    ]}
                    numberOfLines={3}
                  >
                    {banner.body}
                  </Text>
                ) : null}
                {ctas.length > 0 ? (
                  <View
                    style={[
                      styles.ctaRow,
                      textAlign === "center" && styles.rowCenter,
                    ]}
                  >
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
    position: "relative",
  },
  cardBodyOverBg: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardBodyCenter: {
    alignItems: "center",
  },
  rowCenter: {
    justifyContent: "center",
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
