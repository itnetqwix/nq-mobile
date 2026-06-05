import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  EmptyState,
  ImageWithSkeleton,
  MorphRefreshScrollSurface,
  Skeleton,
  SkeletonGroup,
} from "../../../components/ui";
import {
  FLATLIST_PERF_DEFAULTS,
  instantBookingRowGetItemLayout,
} from "../../../lib/lists/flatListPerf";
import { flatListKeyExtractor } from "../../../lib/lists/trainerListUtils";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { queryKeys } from "../../../lib/queryKeys";
import { fetchOnlineUsers } from "../../home/api/homeApi";
import { InstantLessonBookingWizardModal } from "../../instant-lesson/booking-wizard";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

function TrainerAvatar({ uri, name, size = 56 }: { uri?: string; name?: string; size?: number }) {
  const c = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        fallback: {
          backgroundColor: c.brandNavy,
          alignItems: "center",
          justifyContent: "center",
        },
        initial: { fontWeight: "700", color: c.brandTextOn },
      }),
    [c.brandNavy, c.brandTextOn]
  );
  const url = getS3ImageUrl(uri);
  if (url) {
    return (
      <ImageWithSkeleton uri={url} width={size} height={size} borderRadius={size / 2} resizeMode="cover" />
    );
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initial, { fontSize: size * 0.38 }]}>
        {(name ?? "?")[0]?.toUpperCase()}
      </Text>
    </View>
  );
}

export function InstantBookingScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: palette.surface },
      list: { padding: space.md, gap: space.sm, paddingBottom: space.xl },
      listHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
      listHeaderText: { ...typography.bodySm, fontWeight: "700", color: palette.brandNavy },
      trainerCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        padding: space.md,
        borderWidth: 1,
        borderColor: palette.border,
        gap: space.md,
      },
      trainerInfo: { flex: 1 },
      trainerName: { ...typography.subtitle, color: palette.text },
      onlineRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
      onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: palette.success },
      onlineText: { ...typography.caption, color: palette.success, fontWeight: "600" },
      trainerCat: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
    })
  );

  const [wizardTrainer, setWizardTrainer] = useState<Record<string, unknown> | null>(null);

  const { data: onlineUsers = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.presence.onlineUsers,
    queryFn: fetchOnlineUsers,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const onlineTrainers = Array.isArray(onlineUsers)
    ? onlineUsers.filter((u: any) => {
        const at = String(u?.account_type ?? u?.accountType ?? "").toLowerCase();
        return at === "trainer";
      })
    : [];

  return (
    <View style={styles.root}>
      <InstantLessonBookingWizardModal
        visible={!!wizardTrainer}
        trainer={wizardTrainer}
        onDismiss={() => setWizardTrainer(null)}
      />

      {isLoading ? (
        <SkeletonGroup
          count={4}
          gap={space.md}
          style={styles.list}
          renderRow={() => <Skeleton width="100%" height={88} radius={radii.md} />}
        />
      ) : (
        <MorphRefreshScrollSurface
          onRefresh={refetch}
          externalRefreshing={isRefetching}
          tintColor={c.brandNavy}
        >
          {({ refreshControl, onScroll, scrollEventThrottle }) => (
        <FlatList
          data={onlineTrainers}
          keyExtractor={flatListKeyExtractor}
          renderItem={({ item }) => {
            const name = item?.fullname ?? item?.fullName ?? t("instantBooking.trainerDefault");
            return (
              <View style={styles.trainerCard}>
                <TrainerAvatar uri={item?.profile_picture} name={name} size={56} />
                <View style={styles.trainerInfo}>
                  <Text style={styles.trainerName}>{name}</Text>
                  <View style={styles.onlineRow}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>{t("instantBooking.onlineNow")}</Text>
                  </View>
                  {!!item?.category && (
                    <Text style={styles.trainerCat} numberOfLines={1}>{item.category}</Text>
                  )}
                </View>
                <Button
                  label={t("instantBooking.bookNow")}
                  leftIcon="flash"
                  size="sm"
                  fullWidth={false}
                  onPress={() => setWizardTrainer(item)}
                />
              </View>
            );
          }}
          contentContainerStyle={styles.list}
          refreshControl={refreshControl}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          {...FLATLIST_PERF_DEFAULTS}
          getItemLayout={instantBookingRowGetItemLayout}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Ionicons name="people" size={18} color={c.brandNavy} />
              <Text style={styles.listHeaderText}>
                {t("instantBooking.trainersOnline", { count: onlineTrainers.length })}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="wifi-outline"
              title={t("instantBooking.emptyTitle")}
              description={t("instantBooking.emptyDescription")}
            />
          }
        />
          )}
        </MorphRefreshScrollSurface>
      )}
    </View>
  );
}
