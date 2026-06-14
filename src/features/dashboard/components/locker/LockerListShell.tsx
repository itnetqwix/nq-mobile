import React from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClipCardSkeleton, EmptyState, MorphRefreshHeader, SkeletonGroup, type SkeletonGroupProps } from "../../../../components/ui";
import { getApiErrorMessage } from "../../../../lib/http/getApiErrorMessage";
import { useMorphRefreshBundle } from "../../../../lib/refresh/useMorphRefreshBundle";
import { space, useThemeColors, useThemedStyles } from "../../../../theme";
import { useFloatingTabBarBottomInset } from "../../../../navigation/useFloatingTabBarBottomInset";

type Props = {
  loading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  skeletonRows?: number;
  /** Override the per-row skeleton — defaults to `ClipCardSkeleton`. */
  renderSkeletonRow?: SkeletonGroupProps["renderRow"];
  /** When false, skip top safe-area padding (parent stack header already applies insets). */
  applyTopSafeArea?: boolean;
};

export function LockerListShell({
  loading,
  isError,
  error,
  onRetry,
  refreshing,
  onRefresh,
  toolbar,
  children,
  contentStyle,
  skeletonRows = 3,
  renderSkeletonRow,
  applyTopSafeArea = true,
}: Props) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const morph = useMorphRefreshBundle(onRefresh, refreshing);
  const bottomPad = useFloatingTabBarBottomInset(space.md);
  const topPad = applyTopSafeArea ? Math.max(insets.top, space.sm) : 0;
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: palette.background },
      toolbar: {
        paddingTop: 0,
        paddingHorizontal: space.md,
        paddingBottom: space.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
        backgroundColor: palette.surface,
      },
      scroll: { flex: 1 },
      content: {
        paddingHorizontal: space.md,
        paddingTop: space.md,
        gap: space.md,
        flexGrow: 1,
      },
      skeletonWrap: {
        flex: 1,
        paddingHorizontal: space.md,
        paddingTop: space.md,
        gap: space.md,
      },
      errorBox: {
        flex: 1,
        padding: space.lg,
        justifyContent: "center",
        alignItems: "center",
        gap: space.md,
      },
    })
  );

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: topPad }]}>
        {toolbar ? <View style={styles.toolbar}>{toolbar}</View> : null}
        <View style={styles.skeletonWrap}>
          <SkeletonGroup
            count={skeletonRows}
            gap={space.md}
            renderRow={renderSkeletonRow ?? (() => <ClipCardSkeleton />)}
          />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.root, { paddingTop: topPad }]}>
        {toolbar ? <View style={styles.toolbar}>{toolbar}</View> : null}
        <View style={styles.errorBox}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load locker"
            description={getApiErrorMessage(error, "Check your connection and try again.")}
            actionLabel="Retry"
            onAction={onRetry}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {toolbar ? <View style={styles.toolbar}>{toolbar}</View> : null}
      <MorphRefreshHeader {...morph.headerProps} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentStyle, { paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        onScroll={morph.onMorphScroll}
        scrollEventThrottle={morph.scrollEventThrottle}
        refreshControl={
          <RefreshControl
            refreshing={morph.refreshing}
            onRefresh={morph.onRefreshControl}
            tintColor={c.brandAccent}
          />
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}
