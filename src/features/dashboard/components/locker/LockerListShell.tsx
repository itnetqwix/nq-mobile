import React from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { EmptyState, Skeleton } from "../../../../components/ui";
import { getApiErrorMessage } from "../../../../lib/http/getApiErrorMessage";
import { radii, space, useThemedStyles } from "../../../../theme";

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
}: Props) {
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: palette.background },
      toolbar: {
        paddingHorizontal: space.md,
        paddingBottom: space.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      scroll: { flex: 1 },
      content: {
        padding: space.md,
        paddingBottom: space.xl * 2,
        gap: space.md,
        flexGrow: 1,
      },
      skeletonWrap: { flex: 1, padding: space.md, gap: space.md },
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
      <View style={styles.root}>
        {toolbar ? <View style={styles.toolbar}>{toolbar}</View> : null}
        <View style={styles.skeletonWrap}>
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <Skeleton key={i} width="100%" height={96} radius={radii.md} />
          ))}
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.root}>
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
    <View style={styles.root}>
      {toolbar ? <View style={styles.toolbar}>{toolbar}</View> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}
