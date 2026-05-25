import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { EmptyState, Pill, Skeleton, SkeletonGroup, TransactionRowSkeleton } from "../../../components/ui";
import { space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { AccountType } from "../../../constants/accountType";
import { useAuth } from "../../auth/context/AuthContext";
import { dedupeRowsById, fetchBookingTransactions } from "../../home/api/homeApi";
import type { MenuStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";
import { flatListKeyExtractor } from "../../../lib/lists/trainerListUtils";
import { useHapticRefresh } from "../../../lib/refresh/useHapticRefresh";

const PAGE_SIZE = 25;

function formatBookedDate(d?: string): string {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    }
  } catch {
    /* fall through */
  }
  return String(d);
}

function bookingAmountDisplay(booking: any, isTrainer: boolean): string {
  const amount = Number(booking?.amount ?? 0);
  const fee = Number(booking?.application_fee_amount ?? 0);
  const usd = isTrainer ? amount - fee : amount;
  return `$${usd.toFixed(2)}`;
}

function getStatusTone(status: string): React.ComponentProps<typeof Pill>["tone"] {
  const s = String(status).toLowerCase();
  if (s.includes("success") || s.includes("confirm") || s.includes("paid")) return "success";
  if (s.includes("pending") || s.includes("process")) return "warning";
  if (s.includes("fail") || s.includes("cancel") || s.includes("refund")) return "danger";
  return "neutral";
}

function TransactionRow({
  booking,
  isTrainer,
  onPress,
}: {
  booking: any;
  isTrainer: boolean;
  onPress: () => void;
}) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useTransactionStyles();
  const other = isTrainer ? booking?.trainee_info : booking?.trainer_info;
  const name = other?.fullName ?? other?.fullname ?? t("transactions.sessionDefault");
  const status = booking?.refund_status ?? booking?.status ?? "—";
  const dateLabel = formatBookedDate(booking?.booked_date);
  const timeRange =
    booking?.session_start_time && booking?.session_end_time
      ? `${booking.session_start_time} – ${booking.session_end_time}`
      : "";

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.iconBox}>
        <Ionicons name="receipt-outline" size={18} color={c.iconPrimary} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowDesc} numberOfLines={2}>
          {t("transactions.sessionWith", { name })}
        </Text>
        <Text style={styles.rowDate}>
          {[dateLabel, timeRange].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowAmount}>{bookingAmountDisplay(booking, isTrainer)}</Text>
        <Pill label={String(status)} tone={getStatusTone(status)} />
        <Ionicons name="chevron-forward" size={16} color={c.textMuted} style={{ marginTop: 4 }} />
      </View>
    </Pressable>
  );
}

function useTransactionStyles() {
  return useThemedStyles((c) =>
    StyleSheet.create({
      list: { paddingBottom: space.xl },
      listHeader: {
        paddingHorizontal: space.md,
        paddingTop: space.md,
        paddingBottom: space.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
        marginBottom: space.xs,
      },
      pageTitle: { ...typography.titleSm, color: c.text },
      pageSub: { ...typography.bodySm, color: c.textMuted, marginTop: 6, lineHeight: 20 },
      row: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: space.md,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.borderSubtle,
        backgroundColor: c.surfaceElevated,
        gap: space.sm,
      },
      iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: c.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
      },
      rowInfo: { flex: 1 },
      rowDesc: { ...typography.bodyMd, fontWeight: "600", color: c.text },
      rowDate: { ...typography.caption, color: c.textMuted, marginTop: 2 },
      rowRight: { alignItems: "flex-end", gap: 4 },
      rowAmount: { ...typography.bodyMd, fontWeight: "700", color: c.text },
    })
  );
}

export function TransactionsScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useTransactionStyles();
  const { accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();

  const {
    data,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.transactions.bookingListById,
    queryFn: ({ pageParam }) =>
      fetchBookingTransactions({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _all, lastPageParam) =>
      lastPage.length >= PAGE_SIZE ? lastPageParam + 1 : undefined,
    staleTime: 60_000,
  });

  const rows = useMemo(
    () => dedupeRowsById(data?.pages.flat() ?? []),
    [data?.pages]
  );

  const openDetail = useCallback(
    (bookingId: string) => {
      navigation.navigate("TransactionDetail", { bookingId });
    },
    [navigation]
  );

  const { refreshing: transactionsRefreshing, onRefresh: onRefreshTransactions } =
    useHapticRefresh(refetch);

  if (isLoading) {
    /** Content-shape skeleton mirrors the real wallet row (icon + label +
     *  amount + pill) so the page doesn't snap into a different layout
     *  the moment results land. */
    return (
      <View style={{ padding: space.md, gap: space.sm }}>
        <Skeleton width="40%" height={20} style={{ marginBottom: space.xs }} />
        <SkeletonGroup count={6} renderRow={() => <TransactionRowSkeleton />} />
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={flatListKeyExtractor}
      renderItem={({ item }) => (
        <TransactionRow
          booking={item}
          isTrainer={isTrainer}
          onPress={() => item?._id && openDetail(String(item._id))}
        />
      )}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={styles.pageTitle}>{t("transactions.bookingHistory")}</Text>
          <Text style={styles.pageSub}>{t("transactions.pageSub")}</Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={transactionsRefreshing}
          onRefresh={onRefreshTransactions}
          tintColor={c.iconPrimary}
        />
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator style={{ padding: space.md }} color={c.iconPrimary} />
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          icon="receipt-outline"
          title={t("transactions.emptyTitle")}
          description={t("transactions.emptyDescription")}
          /**
           * Trainees → "Book your first lesson". Trainers → "Publish your
           * availability". Either way the empty state moves the user
           * forward instead of being a dead-end.
           */
          actionLabel={
            isTrainer
              ? t("transactions.emptyCtaTrainer", { defaultValue: "Publish availability" })
              : t("transactions.emptyCtaTrainee", { defaultValue: "Book a lesson" })
          }
          onAction={() => {
            try {
              if (isTrainer) {
                navigation.navigate("ShellSurface", { surfaceId: "trainerSchedule" });
              } else {
                navigation.navigate("DashboardFeature", { featureId: "book-lesson" });
              }
            } catch {
              /* Older navigators — best effort. */
            }
          }}
        />
      }
    />
  );
}

