import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Button,
  EmptyState,
  MorphRefreshScrollSurface,
  Pill,
  Skeleton,
  SkeletonGroup,
  TransactionRowSkeleton,
} from "../../../components/ui";
import {
  FLASHLIST_PERF_DEFAULTS,
} from "../../../lib/lists/flatListPerf";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { AccountType } from "../../../constants/accountType";
import { useAuth } from "../../auth/context/AuthContext";
import { dedupeRowsById, fetchBookingTransactions } from "../../home/api/homeApi";
import type { MenuStackParamList } from "../../../navigation/types";
import { openShellSurface } from "../../../navigation/openShellSurface";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";
import { useFloatingTabBarBottomInset } from "../../../navigation/useFloatingTabBarBottomInset";
import { flatListKeyExtractor } from "../../../lib/lists/trainerListUtils";
import { useHapticRefresh } from "../../../lib/refresh/useHapticRefresh";
import { formatCurrency, useCurrencyFormatter } from "../../../lib/intl";

/**
 * Filter categories surfaced in the transactions screen. Mapped to the
 * row's status / refund_status field at filter time — keeps the backend
 * filtering as a future enhancement; for now everything is done client-side
 * on the rows we already paged in.
 */
type TxFilterType = "all" | "topup" | "lesson" | "refund" | "withdrawal";

/**
 * Returns true if a booking row matches the active type filter. Centralised
 * so the predicate can grow (e.g. distinguish refunds from disputes) in
 * one place.
 */
function matchesTypeFilter(booking: any, type: TxFilterType): boolean {
  if (type === "all") return true;
  const refund = String(booking?.refund_status ?? "").toLowerCase();
  const status = String(booking?.status ?? "").toLowerCase();
  const entryType = String(booking?.entry_type ?? booking?.reference_type ?? "").toLowerCase();
  if (type === "refund") {
    return refund.includes("refund") || status.includes("refund") || entryType.includes("refund");
  }
  if (type === "topup") {
    return entryType.includes("topup") || entryType.includes("credit");
  }
  if (type === "withdrawal") {
    return entryType.includes("withdraw") || entryType.includes("payout");
  }
  if (type === "lesson") {
    // Anything that isn't a refund / wallet movement is a lesson booking.
    return !refund.includes("refund") && !entryType.includes("topup") && !entryType.includes("withdraw");
  }
  return true;
}

/**
 * Returns true if the row falls within the [from, to] window. We compare
 * `booked_date` first (the user-visible "session" date) and fall back to
 * `createdAt` for wallet-level entries that don't have a booking date.
 */
function matchesDateFilter(booking: any, from: Date | null, to: Date | null): boolean {
  if (!from && !to) return true;
  const raw = booking?.booked_date ?? booking?.createdAt ?? booking?.created_at;
  const t = raw ? new Date(raw).getTime() : Number.NaN;
  if (Number.isNaN(t)) return true;
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime() + 24 * 60 * 60 * 1000 - 1) return false;
  return true;
}

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
  const net = isTrainer ? amount - fee : amount;
  /**
   * Pure helper used by the row renderer. We can't call the hook here, so
   * we delegate to the module-level `formatCurrency` which still picks the
   * right locale + symbol. The booking object carries its own `currency`
   * (set by the backend at charge time) and we prefer that over the
   * locale default so historical receipts stay readable in their original
   * denomination.
   */
  return formatCurrency(net, { currency: booking?.currency });
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
      filterBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
      },
      filterChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surfaceElevated,
      },
      filterChipActive: { backgroundColor: c.brandNavy, borderColor: c.brandNavy },
      filterChipText: { ...typography.caption, color: c.text, fontWeight: "600" },
      filterChipTextActive: { color: c.brandTextOn },
      filterTypeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: space.xs,
        paddingHorizontal: space.md,
        paddingBottom: space.sm,
      },
      modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
      },
      modalSheet: {
        backgroundColor: c.surface,
        padding: space.lg,
        borderTopLeftRadius: radii.lg,
        borderTopRightRadius: radii.lg,
        gap: space.md,
      },
      modalTitle: { ...typography.titleSm, color: c.text },
      rangeRow: { flexDirection: "row", gap: space.sm },
      rangeChip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surfaceElevated,
        alignItems: "center",
      },
      rangeChipActive: { backgroundColor: c.brandNavy, borderColor: c.brandNavy },
      rangeChipText: { ...typography.bodySm, color: c.text, fontWeight: "600" },
      rangeChipTextActive: { color: c.brandTextOn },
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

/**
 * Preset date windows. We don't ship a full calendar picker — for finance
 * UX, "this week / month / last 30 days / custom" handles ~95% of intents
 * and keeps the sheet lightweight. Custom is enabled by tapping the range
 * row and entering ISO dates inline (planned follow-up).
 */
const DATE_PRESETS = ["all", "thisWeek", "thisMonth", "last30", "last90"] as const;
type DatePresetId = typeof DATE_PRESETS[number];

function datePresetWindow(id: DatePresetId): { from: Date | null; to: Date | null } {
  if (id === "all") return { from: null, to: null };
  const now = new Date();
  if (id === "thisWeek") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return { from: start, to: now };
  }
  if (id === "thisMonth") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start, to: now };
  }
  if (id === "last30") {
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    return { from: start, to: now };
  }
  if (id === "last90") {
    const start = new Date(now);
    start.setDate(now.getDate() - 90);
    return { from: start, to: now };
  }
  return { from: null, to: null };
}

export function TransactionsScreen() {
  const { t } = useAppTranslation();
  const bottomPad = useFloatingTabBarBottomInset(space.md);
  const c = useThemeColors();
  const styles = useTransactionStyles();
  const { accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();

  const [typeFilter, setTypeFilter] = useState<TxFilterType>("all");
  const [datePreset, setDatePreset] = useState<DatePresetId>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const {
    data,
    isLoading,
    isRefetching,
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

  const rawRows = useMemo(
    () => dedupeRowsById(data?.pages.flat() ?? []),
    [data?.pages]
  );

  /**
   * Apply the (type, date) filter combo locally. We keep the original page
   * cache untouched so the filter is *purely a presentation concern*:
   * toggling filters never re-fetches the API.
   */
  const rows = useMemo(() => {
    const window = datePresetWindow(datePreset);
    return rawRows.filter(
      (row: any) =>
        matchesTypeFilter(row, typeFilter) &&
        matchesDateFilter(row, window.from, window.to)
    );
  }, [rawRows, typeFilter, datePreset]);

  const hasFilters = typeFilter !== "all" || datePreset !== "all";
  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (typeFilter !== "all") {
      parts.push(t(`transactions.filterType.${typeFilter}`, { defaultValue: typeFilter }));
    }
    if (datePreset !== "all") {
      parts.push(t(`transactions.dateRange.${datePreset}`, { defaultValue: datePreset }));
    }
    return parts.length > 0
      ? parts.join(" · ")
      : t("transactions.filterAll", { defaultValue: "All transactions" });
  }, [typeFilter, datePreset, t]);

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
    <>
    <MorphRefreshScrollSurface
      onRefresh={onRefreshTransactions}
      externalRefreshing={transactionsRefreshing || isRefetching}
      tintColor={c.iconPrimary}
    >
      {({ refreshControl, onScroll, scrollEventThrottle }) => (
    <FlashList
      data={rows}
      keyExtractor={flatListKeyExtractor}
      renderItem={({ item }) => (
        <TransactionRow
          booking={item}
          isTrainer={isTrainer}
          onPress={() => item?._id && openDetail(String(item._id))}
        />
      )}
      contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
      refreshControl={refreshControl}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      {...FLASHLIST_PERF_DEFAULTS}
      ListHeaderComponent={
        <>
          <View style={styles.listHeader}>
            <Text style={styles.pageTitle}>{t("transactions.bookingHistory")}</Text>
            <Text style={styles.pageSub}>{t("transactions.pageSub")}</Text>
          </View>
          <View style={styles.filterBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("transactions.openFilters", { defaultValue: "Open filters" })}
              onPress={() => setFiltersOpen(true)}
              style={[styles.filterChip, hasFilters && styles.filterChipActive]}
            >
              <Ionicons
                name="filter-outline"
                size={14}
                color={hasFilters ? c.brandTextOn : c.text}
              />
              <Text style={[styles.filterChipText, hasFilters && styles.filterChipTextActive]}>
                {filterSummary}
              </Text>
              {hasFilters ? (
                <Ionicons
                  name="close-circle"
                  size={14}
                  color={c.brandTextOn}
                  onPress={() => {
                    setTypeFilter("all");
                    setDatePreset("all");
                  }}
                />
              ) : null}
            </Pressable>
          </View>
        </>
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
        hasFilters ? (
          <EmptyState
            icon="filter-outline"
            title={t("transactions.filteredEmptyTitle", { defaultValue: "No transactions match" })}
            description={t("transactions.filteredEmptyDescription", {
              defaultValue: "Try widening the date range or clearing the type filter.",
            })}
            actionLabel={t("transactions.clearFilters", { defaultValue: "Clear filters" })}
            onAction={() => {
              setTypeFilter("all");
              setDatePreset("all");
            }}
          />
        ) : (
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
                openShellSurface(navigation, { surfaceId: "trainerSchedule" });
              } else {
                navigation.navigate("DashboardFeature", { featureId: "book-lesson" });
              }
            } catch {
              /* Older navigators — best effort. */
            }
          }}
        />
        )
      }
    />
      )}
    </MorphRefreshScrollSurface>

    <Modal
      visible={filtersOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setFiltersOpen(false)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setFiltersOpen(false)}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{t("transactions.filtersTitle", { defaultValue: "Filter transactions" })}</Text>

          <Text style={[styles.pageSub, { marginTop: 0 }]}>
            {t("transactions.filterTypeLabel", { defaultValue: "Type" })}
          </Text>
          <View style={styles.filterTypeRow}>
            {(["all", "lesson", "refund", "topup", "withdrawal"] as TxFilterType[]).map((type) => {
              const active = typeFilter === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setTypeFilter(type)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {t(`transactions.filterType.${type}`, { defaultValue: type })}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.pageSub}>
            {t("transactions.dateRangeLabel", { defaultValue: "Date range" })}
          </Text>
          <View style={styles.rangeRow}>
            {DATE_PRESETS.map((preset) => {
              const active = datePreset === preset;
              return (
                <Pressable
                  key={preset}
                  onPress={() => setDatePreset(preset)}
                  style={[styles.rangeChip, active && styles.rangeChipActive]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.rangeChipText, active && styles.rangeChipTextActive]}>
                    {t(`transactions.dateRange.${preset}`, { defaultValue: preset })}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Button
            label={t("common.done")}
            onPress={() => setFiltersOpen(false)}
            fullWidth
            style={{ marginTop: space.sm }}
          />
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

