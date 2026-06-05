import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { HeroCarouselSkeleton } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { type HomeBanner, type HomeBannerCta } from "../../content/api/contentApi";
import { useCmsHomeHero } from "../../content/hooks/useCmsHome";
import { dismissedBanners } from "../../content/dismissedBanners";
import { isReactNavigationDeepLink } from "../../content/lib/deepLinks";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_GAP = space.sm;
const DEFAULT_ADVANCE_SEC = 5;
const CARD_ASPECT = 0.45;

type Props = {
  guest?: boolean;
  onDeepLink?: (url: string) => void;
  /** Width inside horizontal gutter; avoids oversized cards on notched devices. */
  contentWidth?: number;
};

function heroCardMetrics(contentWidth?: number) {
  const cardW = Math.round(contentWidth ?? SCREEN_W - space.md * 2);
  return { cardW, cardH: Math.round(cardW * CARD_ASPECT) };
}

function bannerImageUri(banner: HomeBanner): string | null {
  const raw = banner.image_url?.trim();
  if (!raw) return null;
  return getS3ImageUrl(raw) ?? raw;
}

function openCta(url: string, onDeepLink?: (url: string) => void) {
  if (isReactNavigationDeepLink(url) && onDeepLink) {
    onDeepLink(url);
    return;
  }
  Linking.openURL(url).catch(() => {});
}

function HeroCtaRow({
  banner,
  onDeepLink,
}: {
  banner: HomeBanner;
  onDeepLink?: (url: string) => void;
}) {
  const ctas: HomeBannerCta[] =
    banner.ctas?.length
      ? banner.ctas
      : banner.cta_label && banner.cta_url
        ? [{ label: banner.cta_label, url: banner.cta_url, variant: "primary" }]
        : [];

  if (!ctas.length) return null;

  return (
    <View style={styles.ctaRow}>
      {ctas.slice(0, 2).map((cta, i) => (
        <Pressable
          key={`${cta.label}-${i}`}
          onPress={() => openCta(cta.url, onDeepLink)}
          style={[
            styles.ctaBtn,
            cta.variant === "primary" && styles.ctaBtnPrimary,
          ]}
        >
          <Text
            style={[
              typography.label,
              { color: cta.variant === "primary" ? "#fff" : "#fff" },
            ]}
            numberOfLines={1}
          >
            {cta.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function HeroCard({
  banner,
  cardW,
  cardH,
  onDeepLink,
  onDismiss,
}: {
  banner: HomeBanner;
  cardW: number;
  cardH: number;
  onDeepLink?: (url: string) => void;
  onDismiss?: () => void;
}) {
  const c = useThemeColors();
  const imageUri = bannerImageUri(banner);
  const tappable = !!(banner.cta_url || banner.ctas?.length);

  const body = (
    <View style={[styles.card, { width: cardW, height: cardH, borderColor: c.border }]}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.cardImage} contentFit="cover" />
      ) : (
        <View style={[styles.cardImage, { backgroundColor: c.brandAccentSubtle }]} />
      )}
      <View style={styles.cardOverlay}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {banner.title}
        </Text>
        {banner.body ? (
          <Text style={styles.cardBody} numberOfLines={2}>
            {banner.body}
          </Text>
        ) : null}
        <HeroCtaRow banner={banner} onDeepLink={onDeepLink} />
      </View>
      {banner.dismissible && onDismiss ? (
        <Pressable style={styles.dismiss} onPress={onDismiss} hitSlop={10}>
          <Ionicons name="close" size={18} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );

  if (!tappable) return body;

  return (
    <Pressable
      onPress={() => banner.cta_url && openCta(banner.cta_url, onDeepLink)}
      style={({ pressed }) => pressed && { opacity: 0.94 }}
    >
      {body}
    </Pressable>
  );
}

/**
 * Blinkit-style hero carousel — CMS `placement=hero`, auto-advance from admin.
 */
export function HomeHeroCarousel({ guest, onDeepLink, contentWidth }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const { cardW, cardH } = useMemo(() => heroCardMetrics(contentWidth), [contentWidth]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const userDragging = useRef(false);

  useEffect(() => {
    let mounted = true;
    void dismissedBanners.list().then((ids) => {
      if (mounted) setDismissedIds(ids);
    });
    const unsub = dismissedBanners.subscribe(() => {
      void dismissedBanners.list().then((ids) => {
        if (mounted) setDismissedIds(ids);
      });
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const { data, isLoading, isFetching } = useCmsHomeHero(guest);

  const items = useMemo(
    () => (data ?? []).filter((b) => !dismissedIds.includes(String(b._id))),
    [data, dismissedIds]
  );

  const advanceMs = useMemo(() => {
    const sec = items[page]?.auto_advance_sec ?? items[0]?.auto_advance_sec ?? DEFAULT_ADVANCE_SEC;
    const clamped = Math.min(60, Math.max(3, sec || DEFAULT_ADVANCE_SEC));
    return clamped * 1000;
  }, [items, page]);

  const scrollToPage = useCallback(
    (idx: number, animated = true) => {
      scrollRef.current?.scrollTo({
        x: idx * (cardW + CARD_GAP),
        animated,
      });
      setPage(idx);
    },
    [cardW]
  );

  useEffect(() => {
    if (items.length <= 1 || paused || userDragging.current) return;
    const timer = setInterval(() => {
      const next = (page + 1) % items.length;
      scrollToPage(next);
    }, advanceMs);
    return () => clearInterval(timer);
  }, [items.length, page, paused, advanceMs, scrollToPage]);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / (cardW + CARD_GAP));
      setPage(Math.max(0, Math.min(idx, Math.max(0, items.length - 1))));
      userDragging.current = false;
    },
    [items.length, cardW]
  );

  const handleDismiss = useCallback((id: string) => {
    void dismissedBanners.dismiss(id);
  }, []);

  if (isLoading || (isFetching && !items.length)) {
    return <HeroCarouselSkeleton />;
  }

  if (!items.length) return null;

  return (
    <View style={styles.root}>
      <View style={[styles.headerRow, contentWidth != null && styles.headerRowInset]}>
        <Text style={[typography.titleSm, { color: c.text, fontWeight: "800" }]}>
          {t("homeMarketplace.featured", { defaultValue: "Featured" })}
        </Text>
        {items.length > 1 ? (
          <Text style={[typography.caption, { color: c.textMuted, fontWeight: "600" }]}>
            {page + 1}/{items.length}
          </Text>
        ) : null}
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={[styles.strip, contentWidth != null && styles.stripInset]}
        onMomentumScrollEnd={onScrollEnd}
        onScrollBeginDrag={() => {
          userDragging.current = true;
          setPaused(true);
        }}
        onScrollEndDrag={() => {
          userDragging.current = false;
          setPaused(false);
        }}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {items.map((banner) => (
          <HeroCard
            key={String(banner._id)}
            banner={banner}
            cardW={cardW}
            cardH={cardH}
            onDeepLink={onDeepLink}
            onDismiss={
              banner.dismissible
                ? () => handleDismiss(String(banner._id))
                : undefined
            }
          />
        ))}
      </ScrollView>
      {items.length > 1 ? (
        <View style={styles.dots}>
          {items.map((b, i) => (
            <Pressable key={String(b._id)} onPress={() => scrollToPage(i)} hitSlop={8}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === page ? c.brandAccent : c.border,
                    width: i === page ? 18 : 6,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: space.sm },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    marginBottom: space.xs,
  },
  headerRowInset: {
    paddingHorizontal: 0,
  },
  strip: {
    paddingHorizontal: space.md,
    gap: CARD_GAP,
  },
  stripInset: {
    paddingHorizontal: 0,
  },
  card: {
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: space.md,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  cardTitle: {
    ...typography.titleSm,
    fontWeight: "800",
    color: "#fff",
  },
  cardBody: {
    ...typography.bodySm,
    color: "rgba(255,255,255,0.92)",
    marginTop: 2,
  },
  ctaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    marginTop: space.sm,
  },
  ctaBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  ctaBtnPrimary: {
    backgroundColor: "rgba(25,118,210,0.95)",
    borderColor: "transparent",
  },
  dismiss: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: space.sm,
    paddingBottom: space.xs,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
