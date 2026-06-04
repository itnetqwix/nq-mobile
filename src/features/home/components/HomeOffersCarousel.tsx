import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useCallback } from "react";
import {
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { OffersCarouselSkeleton } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { useMarketplaceHorizontalPad } from "../layout/marketplaceLayout";
import { fetchHomeTips, type Tip } from "../../content/api/contentApi";
import { isReactNavigationDeepLink } from "../../content/lib/deepLinks";

const OFFER_W = Math.round(Dimensions.get("window").width * 0.72);

type Props = {
  guest?: boolean;
  onDeepLink?: (url: string) => void;
};

function openTip(tip: Tip, onDeepLink?: (url: string) => void) {
  const url = tip.cta_url?.trim();
  if (!url) return;
  if (isReactNavigationDeepLink(url) && onDeepLink) {
    onDeepLink(url);
    return;
  }
  Linking.openURL(url).catch(() => {});
}

/**
 * Blinkit "Offers for you" — horizontal admin tips carousel.
 */
export function HomeOffersCarousel({ guest, onDeepLink }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const marketplacePad = useMarketplaceHorizontalPad();

  const { data: tips = [], isLoading, isFetching } = useQuery({
    queryKey: [...queryKeys.content.tips, guest ? "guest" : "auth", "offers"] as const,
    queryFn: () => fetchHomeTips({ guest }),
    staleTime: 2 * 60_000,
  });

  const onPress = useCallback(
    (tip: Tip) => openTip(tip, onDeepLink),
    [onDeepLink]
  );

  if (isLoading || (isFetching && !tips.length)) {
    return <OffersCarouselSkeleton />;
  }

  if (!tips.length) return null;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: c.homeMarketplaceBand,
          marginLeft: -marketplacePad.paddingLeft,
          marginRight: -marketplacePad.paddingRight,
        },
      ]}
    >
      <Text style={[styles.ribbon, { color: c.brandNavy }]}>
        {t("homeMarketplace.offersRibbon", { defaultValue: "✦ OFFERS FOR YOU ✦" })}
      </Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        decelerationRate="fast"
      >
        {tips.map((tip) => {
          const img = tip.image_url ? getS3ImageUrl(tip.image_url) ?? tip.image_url : null;
          const tappable = !!tip.cta_url;
          return (
            <Pressable
              key={String(tip._id)}
              disabled={!tappable}
              onPress={() => onPress(tip)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: c.surfaceElevated, borderColor: c.border },
                pressed && tappable && { opacity: 0.92, transform: [{ scale: 0.99 }] },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: c.brandAccentSubtle }]}>
                {img ? (
                  <Image source={{ uri: img }} style={styles.iconImg} contentFit="cover" />
                ) : (
                  <Ionicons name="pricetag" size={22} color={c.brandAccent} />
                )}
              </View>
              <View style={styles.textCol}>
                <Text style={[typography.titleSm, { color: c.text, fontWeight: "700" }]} numberOfLines={2}>
                  {tip.title}
                </Text>
                {tip.body ? (
                  <Text style={[typography.bodySm, { color: c.textMuted }]} numberOfLines={2}>
                    {tip.body}
                  </Text>
                ) : null}
                {tip.cta_label ? (
                  <Text style={[typography.label, { color: c.brandAccent, marginTop: 4 }]}>
                    {tip.cta_label} →
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: space.md,
    marginBottom: space.sm,
  },
  ribbon: {
    textAlign: "center",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.6,
    marginBottom: space.sm,
  },
  strip: {
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  card: {
    width: OFFER_W,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconImg: { width: 48, height: 48 },
  textCol: { flex: 1, minWidth: 0 },
});
