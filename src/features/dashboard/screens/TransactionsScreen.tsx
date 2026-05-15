import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { WalletScreen } from "../../wallet/screens/WalletScreen";
import { TrainerEarningsScreen } from "../../wallet/screens/TrainerEarningsScreen";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { EmptyState, Pill, Skeleton } from "../../../components/ui";
import { colors, space, typography } from "../../../theme";
import { AccountType } from "../../../constants/accountType";
import { useAuth } from "../../auth/context/AuthContext";
import { fetchBookingTransactions } from "../../home/api/homeApi";

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
  return `${usd.toFixed(2)} USD`;
}

function TransactionRow({ booking, isTrainer }: { booking: any; isTrainer: boolean }) {
  const other = isTrainer ? booking?.trainee_info : booking?.trainer_info;
  const name = other?.fullName ?? other?.fullname ?? "Session";
  const status = booking?.refund_status ?? booking?.status ?? "—";
  const dateLabel = formatBookedDate(booking?.booked_date);
  const timeRange =
    booking?.session_start_time && booking?.session_end_time
      ? `${booking.session_start_time} – ${booking.session_end_time}`
      : "";

  return (
    <View style={styles.row}>
      <View style={styles.iconBox}>
        <Ionicons name="receipt-outline" size={18} color={colors.brandNavy} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowDesc} numberOfLines={2}>
          Session with {name}
        </Text>
        <Text style={styles.rowDate}>
          {[dateLabel, timeRange].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowAmount}>{bookingAmountDisplay(booking, isTrainer)}</Text>
        <Pill label={String(status)} tone={getStatusTone(status)} />
      </View>
    </View>
  );
}

function getStatusTone(status: string): React.ComponentProps<typeof Pill>["tone"] {
  const s = String(status).toLowerCase();
  if (s.includes("success") || s.includes("confirm") || s.includes("paid")) return "success";
  if (s.includes("pending") || s.includes("process")) return "warning";
  if (s.includes("fail") || s.includes("cancel") || s.includes("refund")) return "danger";
  return "neutral";
}

export function TransactionsScreen() {
  const { accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;

  const { data: rows = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["transactions", "booking-list-by-id"],
    queryFn: () => fetchBookingTransactions({ page: 1, limit: 500 }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <View style={{ padding: space.md }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ marginBottom: space.sm }}>
            <Skeleton width="100%" height={64} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item, i) => item?._id ?? String(i)}
      renderItem={({ item }) => <TransactionRow booking={item} isTrainer={isTrainer} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={{ marginBottom: space.md }}>
          {isTrainer ? <TrainerEarningsScreen /> : <WalletScreen />}
          <Text style={[styles.sectionTitle, { marginTop: space.lg }]}>Booking history</Text>
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandNavy} />
      }
      ListEmptyComponent={
        <EmptyState
          icon="wallet-outline"
          title="No bookings in this window"
          description="Sessions with amounts and status will appear here."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingBottom: space.xl },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surfaceElevated,
    gap: space.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  rowInfo: { flex: 1 },
  rowDesc: { ...typography.bodyMd, fontWeight: "600", color: colors.text },
  rowDate: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  rowAmount: { ...typography.bodyMd, fontWeight: "700", color: colors.text },
  sectionTitle: { ...typography.titleSm, color: colors.text, marginHorizontal: space.md },
});
