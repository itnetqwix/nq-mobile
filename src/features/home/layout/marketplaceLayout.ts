import { useMemo } from "react";
import { Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHorizontalGutter } from "../../../lib/layout/useHorizontalGutter";
import { floatingTabBarBottomInset } from "../../../navigation/FloatingTabBar";
import { space } from "../../../theme";

type SpaceKey = keyof typeof space;

/** Extra scroll padding so list content clears the sticky bottom promo bar. */
export const MARKETPLACE_STICKY_PROMO_SCROLL_EXTRA = 72;

/** Shared horizontal insets for marketplace chrome, scroll body, sticky promo, and tab screens. */
export function useMarketplaceHorizontalPad(gutter: SpaceKey = "md") {
  return useHorizontalGutter(gutter);
}

/** Usable width inside horizontal gutter (for hero card sizing). */
export function useMarketplaceContentWidth(gutter: SpaceKey = "md") {
  const pad = useMarketplaceHorizontalPad(gutter);
  return useMemo(
    () => Dimensions.get("window").width - pad.paddingLeft - pad.paddingRight,
    [pad.paddingLeft, pad.paddingRight]
  );
}

/**
 * Top padding for DiscoverHomeChrome when a stack header is already shown.
 */
export function useMarketplaceTopPadding(compactTop: boolean) {
  const insets = useSafeAreaInsets();
  return useMemo(
    () => (compactTop ? space.sm : Math.max(insets.top, space.sm)),
    [compactTop, insets.top]
  );
}

/** Bottom padding for marketplace ScrollView content. */
export function useMarketplaceScrollPadding(opts?: {
  stickyPromo?: boolean;
  extra?: number;
}) {
  const insets = useSafeAreaInsets();
  const stickyPromo = opts?.stickyPromo !== false;
  const extra = opts?.extra ?? 0;
  return useMemo(() => {
    const base = floatingTabBarBottomInset(insets.bottom) + space.xl;
    const sticky = stickyPromo ? MARKETPLACE_STICKY_PROMO_SCROLL_EXTRA : 0;
    return base + sticky + extra;
  }, [insets.bottom, stickyPromo, extra]);
}

/** Absolute positioning insets for StickyBottomPromoBar. */
export function useMarketplaceStickyHostInsets(gutter: SpaceKey = "md") {
  const pad = useMarketplaceHorizontalPad(gutter);
  return useMemo(
    () => ({
      left: pad.paddingLeft,
      right: pad.paddingRight,
    }),
    [pad.paddingLeft, pad.paddingRight]
  );
}
