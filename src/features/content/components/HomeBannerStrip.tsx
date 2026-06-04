import React, { useCallback, useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { queryKeys } from "../../../lib/queryKeys";
import { fetchHomeBanners, type HomeBanner } from "../api/contentApi";
import { dismissedBanners } from "../dismissedBanners";
import { isReactNavigationDeepLink } from "../lib/deepLinks";

type Props = {
  /** When true the call is made un-authenticated for guest audiences. */
  guest?: boolean;
  onDeepLink?: (url: string) => void;
};

function severityPalette(
  c: ReturnType<typeof useThemeColors>,
  severity: HomeBanner["severity"]
) {
  switch (severity) {
    case "critical":
      return { bg: "#fdecea", fg: "#8a1c12", icon: "alert-circle-outline" as const };
    case "maintenance":
      return { bg: "#fff4e5", fg: "#7a4d00", icon: "construct-outline" as const };
    case "success":
      return { bg: "#e6f6ee", fg: "#0e6b3e", icon: "checkmark-circle-outline" as const };
    case "promo":
      return { bg: c.brandAccentSubtle, fg: c.brandNavy, icon: "pricetag-outline" as const };
    case "info":
    default:
      return { bg: c.brandAccentSubtle, fg: c.brandNavy, icon: "megaphone-outline" as const };
  }
}

/**
 * Admin-managed banner strip (Phase 2 item 17).
 *
 * Renders the highest-priority active banner. Dismissible banners are
 * remembered locally via `dismissedBanners` so they don't reappear until
 * the admin publishes a new id.
 */
export function HomeBannerStrip({ guest, onDeepLink }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
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

  const { data } = useQuery({
    queryKey: [...queryKeys.content.banners, guest ? "guest" : "auth", "strip"] as const,
    queryFn: () => fetchHomeBanners({ guest, placement: "strip" }),
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: true,
  });

  const banner =
    (data ?? []).find((b) => !dismissedIds.includes(String(b._id))) || null;

  const handleOpen = useCallback(() => {
    if (!banner?.cta_url) return;
    if (isReactNavigationDeepLink(banner.cta_url) && onDeepLink) {
      onDeepLink(banner.cta_url);

      return;
    }
    Linking.openURL(banner.cta_url).catch(() => {});
  }, [banner, onDeepLink]);

  const handleDismiss = useCallback(() => {
    if (!banner) return;
    void dismissedBanners.dismiss(String(banner._id));
  }, [banner]);

  if (!banner) return null;

  const palette = severityPalette(c, banner.severity);
  const tappable = !!banner.cta_url;

  const inner = (
    <View style={[styles.row, { backgroundColor: palette.bg }]}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: c.surfaceElevated, borderColor: c.borderSubtle },
        ]}
      >
        <Ionicons name={palette.icon} size={18} color={palette.fg} />
      </View>
      <View style={styles.textCol}>
        <Text
          style={[typography.titleSm, { color: palette.fg }]}
          numberOfLines={2}
        >
          {banner.title}
        </Text>
        {banner.body ? (
          <Text
            style={[typography.bodySm, { color: palette.fg, opacity: 0.92 }]}
            numberOfLines={3}
          >
            {banner.body}
          </Text>
        ) : null}
        {tappable && banner.cta_label ? (
          <View style={styles.ctaRow}>
            <Text
              style={[typography.label, { color: palette.fg }]}
            >
              {banner.cta_label}
            </Text>
            <Ionicons name="arrow-forward" size={14} color={palette.fg} />
          </View>
        ) : null}
      </View>
      {banner.dismissible ? (
        <Pressable
          onPress={handleDismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("homeBanner.dismissA11y", {
            defaultValue: "Dismiss banner",
          })}
        >
          <Ionicons name="close" size={16} color={palette.fg} />
        </Pressable>
      ) : null}
    </View>
  );

  if (!tappable) {
    return <View style={styles.root}>{inner}</View>;
  }

  return (
    <Pressable
      onPress={handleOpen}
      style={({ pressed }) => [styles.root, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={banner.title}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: space.md,
    marginTop: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radii.lg,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
});
