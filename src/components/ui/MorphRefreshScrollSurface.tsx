import React from "react";
import {
  RefreshControl,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
  type ViewStyle,
} from "react-native";
import { useCombinedScroll } from "../../lib/refresh/useCombinedScroll";
import {
  useMorphRefreshBundle,
  type MorphRefreshBundle,
} from "../../lib/refresh/useMorphRefreshBundle";
import { useThemeColors } from "../../theme";
import { MorphRefreshHeader } from "./MorphRefreshHeader";

export type MorphRefreshScrollRenderProps = {
  refreshControl: React.ReactElement<RefreshControlProps>;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
  bundle: MorphRefreshBundle;
};

type Props = {
  onRefresh: () => void | Promise<unknown>;
  externalRefreshing?: boolean;
  /** e.g. tab-bar hide on home scroll */
  extraOnScroll?: (e: import("react-native").NativeSyntheticEvent<import("react-native").NativeScrollEvent>) => void;
  tintColor?: string;
  style?: ViewStyle;
  children: (props: MorphRefreshScrollRenderProps) => React.ReactNode;
};

/**
 * Morph pull-to-refresh chrome + render-props for ScrollView / FlatList bodies.
 */
export function MorphRefreshScrollSurface({
  onRefresh,
  externalRefreshing = false,
  extraOnScroll,
  tintColor,
  style,
  children,
}: Props) {
  const c = useThemeColors();
  const bundle = useMorphRefreshBundle(onRefresh, externalRefreshing);
  const onScroll = useCombinedScroll(bundle.onMorphScroll, extraOnScroll);

  const refreshControl = (
    <RefreshControl
      refreshing={bundle.refreshing}
      onRefresh={bundle.onRefreshControl}
      tintColor={tintColor ?? c.brandAccent}
      colors={[tintColor ?? c.brandAccent]}
    />
  );

  return (
    <View style={[{ flex: 1 }, style]}>
      <MorphRefreshHeader {...bundle.headerProps} />
      {children({
        refreshControl,
        onScroll,
        scrollEventThrottle: bundle.scrollEventThrottle,
        bundle,
      })}
    </View>
  );
}
