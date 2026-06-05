import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { type HomeBanner } from "../../content/api/contentApi";
import { useCmsHomeSticky } from "../../content/hooks/useCmsHome";
import { dismissedBanners } from "../../content/dismissedBanners";
import { isReactNavigationDeepLink } from "../../content/lib/deepLinks";
import {
  FLOATING_TAB_BAR_BOTTOM_GAP,
  FLOATING_TAB_BAR_HEIGHT,
  floatingTabBarBottomInset,
} from "../../../navigation/FloatingTabBar";
import { useMarketplaceStickyHostInsets } from "../layout/marketplaceLayout";

const STICKY_DISMISS_PREFIX = "sticky:";

type Props = {
  guest?: boolean;
  onDeepLink?: (url: string) => void;
};


/**
 * Blinkit-style slim promo above the tab bar (1/N, dismissible).
 */
export function StickyBottomPromoBar({ guest, onDeepLink }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);

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

  const { data, isLoading } = useCmsHomeSticky(guest);

  const promos = (data ?? []).filter((b) => {
    const id = String(b._id);
    return (
      !dismissedIds.includes(id) && !dismissedIds.includes(STICKY_DISMISS_PREFIX + id)
    );
  });

  const banner = promos[page] ?? promos[0] ?? null;
  const total = promos.length;

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
    void dismissedBanners.dismiss(STICKY_DISMISS_PREFIX + String(banner._id));
    if (page < total - 1) setPage((p) => p + 1);
  }, [banner, page, total]);

  if (isLoading || !banner) return null;

  const stickyInsets = useMarketplaceStickyHostInsets();
  const bottom = floatingTabBarBottomInset(insets.bottom) - FLOATING_TAB_BAR_HEIGHT - FLOATING_TAB_BAR_BOTTOM_GAP;

  return (
    <View
      style={[
        styles.host,
        {
          bottom: Math.max(bottom, insets.bottom + 8),
          left: stickyInsets.left,
          right: stickyInsets.right,
        },
      ]}
    >
      <Pressable
        onPress={banner.cta_url ? handleOpen : undefined}
        style={({ pressed }) => [
          styles.bar,
          { backgroundColor: c.surfaceElevated, borderColor: c.border },
          pressed && banner.cta_url && { opacity: 0.94 },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: c.brandAccentSubtle }]}>
          <Ionicons name="pricetag" size={18} color={c.brandAccent} />
        </View>
        <Text style={[styles.text, { color: c.text }]} numberOfLines={2}>
          {banner.title}
          {banner.body ? ` · ${banner.body}` : ""}
        </Text>
        {total > 1 ? (
          <Text style={[typography.caption, { color: c.textMuted }]}>
            {page + 1}/{total}
          </Text>
        ) : null}
        {banner.dismissible ? (
          <Pressable onPress={handleDismiss} hitSlop={10}>
            <Ionicons name="close" size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    zIndex: 20,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    ...typography.bodySm,
    flex: 1,
    fontWeight: "600",
  },
});
