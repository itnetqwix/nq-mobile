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
import { radii, space, typography, useThemeColors } from "../../../theme";
import { queryKeys } from "../../../lib/queryKeys";
import { useAuth } from "../../auth/context/AuthContext";
import { fetchHomeTips, type Tip } from "../api/contentApi";
import { isReactNavigationDeepLink } from "../lib/deepLinks";

type Props = {
  /** Optional handler for app-internal deep links like `netqwix://wallet`. */
  onDeepLink?: (url: string) => void;
};

/**
 * Admin-driven tips strip (Phase 2 item 5).
 *
 * Renders nothing while loading is empty so we don't reserve vertical
 * space on day-one accounts. Hidden entirely if the API returns no
 * active tips for this audience.
 */
export function TipsCarousel({ onDeepLink }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const { status } = useAuth();

  const { data: tips, isLoading } = useQuery({
    queryKey: queryKeys.content.tips,
    queryFn: fetchHomeTips,
    enabled: status === "signedIn",
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
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

  if (isLoading) {
    return (
      <View style={styles.root}>
        <View style={styles.headerRow}>
          <Ionicons name="bulb-outline" size={16} color={c.textSecondary} />
          <Text style={[typography.titleSm, { color: c.text }]}>
            {t("tips.heading", { defaultValue: "Tips for you" })}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {[0, 1].map((i) => (
            <View
              key={`tip-skel-${i}`}
              style={[
                styles.card,
                { backgroundColor: c.surfaceElevated, borderColor: c.borderSubtle },
              ]}
            >
              <Skeleton height={14} width="60%" />
              <Skeleton height={12} width="80%" style={{ marginTop: 8 }} />
              <Skeleton height={12} width="40%" style={{ marginTop: 4 }} />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (!tips || tips.length === 0) return null;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Ionicons name="bulb-outline" size={16} color={c.textSecondary} />
        <Text style={[typography.titleSm, { color: c.text }]}>
          {t("tips.heading", { defaultValue: "Tips for you" })}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {tips.map((tip, idx) => {
          const tappable = !!tip.cta_url;
          const Wrapper: any = tappable ? Pressable : View;

          return (
            <Wrapper
              key={`tip-${tip._id ?? idx}`}
              onPress={tappable ? () => handleOpen(tip) : undefined}
              style={({ pressed }: { pressed?: boolean } = {}) => [
                styles.card,
                { backgroundColor: c.surfaceElevated, borderColor: c.borderSubtle },
                pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
              ]}
              accessibilityRole={tappable ? "button" : "summary"}
              accessibilityLabel={tip.title}
            >
              {tip.image_url ? (
                <Image
                  source={{ uri: tip.image_url }}
                  style={styles.image}
                  contentFit="cover"
                />
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
              <Text
                style={[typography.titleSm, { color: c.text, marginTop: 12 }]}
                numberOfLines={2}
              >
                {tip.title}
              </Text>
              <Text
                style={[
                  typography.body,
                  { color: c.textSecondary, marginTop: 4 },
                ]}
                numberOfLines={3}
              >
                {tip.body}
              </Text>
              {tip.cta_label ? (
                <View style={styles.ctaRow}>
                  <Text
                    style={[
                      typography.label,
                      { color: c.brandNavy, marginRight: 4 },
                    ]}
                  >
                    {tip.cta_label}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={c.brandNavy}
                  />
                </View>
              ) : null}
            </Wrapper>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: space.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    marginBottom: space.xs,
  },
  scroll: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    gap: space.sm,
  },
  card: {
    width: 240,
    minHeight: 148,
    padding: space.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: {
    width: "100%",
    height: 80,
    borderRadius: radii.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: space.sm,
  },
});
