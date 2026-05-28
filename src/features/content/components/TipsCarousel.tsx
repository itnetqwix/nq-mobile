import React, { useCallback } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { queryKeys } from "../../../lib/queryKeys";
import { useAuth } from "../../auth/context/AuthContext";
import { fetchHomeTips, type Tip } from "../api/contentApi";
import { isReactNavigationDeepLink } from "../lib/deepLinks";

const CARD_WIDTH = 260;
const CARD_GAP = space.sm;

type Props = {
  /** Guest browse: unauthenticated fetch (audience “all” tips only). */
  guest?: boolean;
  /** Optional handler for app-internal deep links like `netqwix://wallet`. */
  onDeepLink?: (url: string) => void;
};

/**
 * Admin-driven “Tips for you” carousel (Content → Tips in admin).
 * Horizontal scroll; audience filtered by the API (trainer / trainee / all).
 */
export function TipsCarousel({ guest = false, onDeepLink }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const { status } = useAuth();

  const {
    data: tips,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [...queryKeys.content.tips, guest ? "guest" : "auth"] as const,
    queryFn: () => fetchHomeTips({ guest }),
    enabled: guest || status === "signedIn",
    staleTime: 2 * 60_000,
    refetchOnMount: "always",
    retry: 2,
  });

  const handleOpen = useCallback(
    (tip: Tip) => {
      if (!tip.cta_url) return;
      if (isReactNavigationDeepLink(tip.cta_url) && onDeepLink) {
        onDeepLink(tip.cta_url);
        return;
      }
      Linking.openURL(tip.cta_url).catch(() => {});
    },
    [onDeepLink]
  );

  const showSection = guest || status === "signedIn";
  if (!showSection) return null;

  const hasTips = (tips?.length ?? 0) > 0;
  const heading = t("tips.heading", { defaultValue: "Tips for you" });

  if (isLoading) {
    return (
      <View style={styles.root} accessibilityRole="summary" accessibilityLabel={heading}>
        <SectionHeader title={heading} count={undefined} colors={c} />
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {[0, 1, 2].map((i) => (
            <View
              key={`tip-skel-${i}`}
              style={[
                styles.card,
                { backgroundColor: c.surfaceElevated, borderColor: c.borderSubtle },
              ]}
            >
              <Skeleton height={14} width="60%" />
              <Skeleton height={12} width="80%" style={{ marginTop: 8 }} />
              <Skeleton height={12} width="50%" style={{ marginTop: 4 }} />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (!hasTips) {
    if (isError) {
      return (
        <View style={styles.root}>
          <SectionHeader title={heading} colors={c} />
          <Pressable
            onPress={() => void refetch()}
            style={[styles.emptyCard, { borderColor: c.borderSubtle, backgroundColor: c.surfaceElevated }]}
          >
            <Ionicons name="refresh-outline" size={18} color={c.brandNavy} />
            <Text style={[typography.bodySm, { color: c.textSecondary, flex: 1 }]}>
              {t("tips.loadError", {
                defaultValue: "Could not load tips. Tap to try again.",
              })}
            </Text>
          </Pressable>
        </View>
      );
    }
    return null;
  }

  return (
    <View style={styles.root} accessibilityRole="summary" accessibilityLabel={heading}>
      <SectionHeader title={heading} count={tips!.length} colors={c} />

      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={styles.scroll}
      >
        {tips!.map((tip, idx) => (
          <TipCard
            key={tip._id ?? `tip-${idx}`}
            tip={tip}
            onPress={handleOpen}
            colors={c}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function SectionHeader({
  title,
  count,
  colors: c,
}: {
  title: string;
  count?: number;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={styles.headerRow}>
      <Ionicons name="bulb-outline" size={18} color={c.brandAccent} />
      <Text style={[typography.titleSm, { color: c.text, flex: 1 }]}>{title}</Text>
      {count != null && count > 0 ? (
        <Text style={[typography.caption, { color: c.textMuted }]}>
          {count}
        </Text>
      ) : null}
    </View>
  );
}

function TipCard({
  tip,
  onPress,
  colors: c,
}: {
  tip: Tip;
  onPress: (tip: Tip) => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const tappable = !!tip.cta_url;
  const imageUri = tip.image_url ? getS3ImageUrl(tip.image_url) : "";
  const Wrapper: any = tappable ? Pressable : View;

  return (
    <Wrapper
      onPress={tappable ? () => onPress(tip) : undefined}
      style={({ pressed }: { pressed?: boolean } = {}) => [
        styles.card,
        { backgroundColor: c.surfaceElevated, borderColor: c.borderSubtle },
        pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
      ]}
      accessibilityRole={tappable ? "button" : "text"}
      accessibilityLabel={tip.title}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" />
      ) : (
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: c.brandAccentSubtle,
              borderColor: c.brandAccent,
            },
          ]}
        >
          <Ionicons
            name={(tip.icon as any) || "bulb-outline"}
            size={20}
            color={c.brandNavy}
          />
        </View>
      )}
      <Text style={[typography.titleSm, styles.cardTitle, { color: c.text }]} numberOfLines={2}>
        {tip.title}
      </Text>
      <Text
        style={[typography.bodySm, { color: c.textSecondary }]}
        numberOfLines={4}
      >
        {tip.body}
      </Text>
      {tip.cta_label ? (
        <View style={styles.ctaRow}>
          <Text style={[typography.label, { color: c.brandNavy, marginRight: 4 }]}>
            {tip.cta_label}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={c.brandNavy} />
        </View>
      ) : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: space.md,
    marginBottom: space.xs,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  scroll: {
    paddingHorizontal: space.md,
    paddingBottom: space.xs,
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    minHeight: 160,
    padding: space.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTitle: {
    marginTop: space.sm,
  },
  image: {
    width: "100%",
    height: 88,
    borderRadius: radii.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: space.sm,
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginHorizontal: space.md,
    padding: space.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
