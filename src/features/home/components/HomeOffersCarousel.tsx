import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ImageWithSkeleton, OffersCarouselSkeleton } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { useContentWidthFraction } from "../../../lib/layout";
import { useMarketplaceHorizontalPad } from "../layout/marketplaceLayout";
import { type Tip } from "../../content/api/contentApi";
import { useCmsHomeTips } from "../../content/hooks/useCmsHome";
import { isReactNavigationDeepLink } from "../../content/lib/deepLinks";

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
  const offerWidth = useContentWidthFraction(0.72);

  const { data: tips = [], isLoading, isFetching } = useCmsHomeTips(guest);

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
                {
                  width: offerWidth,
                  backgroundColor: c.surfaceElevated,
                  borderColor: c.border,
                },
                pressed && tappable && { opacity: 0.92, transform: [{ scale: 0.99 }] },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: c.brandAccentSubtle }]}>
                {img ? (
                  <ImageWithSkeleton uri={img} width={48} height={48} borderRadius={radii.md} />
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
